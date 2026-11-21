// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgentID} from "./interfaces/IAgentID.sol";
import {IReckonCore} from "./interfaces/IReckonCore.sol";

interface IERC20Decimals {
    function decimals() external view returns (uint8);
}

/// @title ReckonSignalRegistry
/// @notice Ownerless, opt-in Layer 3 B402/x402 signal endpoint registry for verified Reckon forecasters.
/// @dev Zero admin keys, zero custody of funds. Payout address is implicitly `msg.sender` (the forecaster's
///      Agent ID wallet), and `isListingActive(agent)` dynamically checks live `ReckonCore.isVerifiedForecaster(agent)`
///      so any agent whose calibration drops below 0.7600 or whose reveal rate falls below 80% automatically
///      loses Verified Signal eligibility in real time.
contract ReckonSignalRegistry {
    // -------------------------------------------------------------------------
    // Constants & Immutables
    // -------------------------------------------------------------------------

    uint256 public constant MIN_PRICE_ATOMIC = 0.10 ether; // $0.10 (18-dec BSC stablecoins; matches facilitator floor)
    uint256 public constant MAX_PRICE_ATOMIC = 50 ether;   // $50.00 safety ceiling
    uint256 public constant MIN_URL_LEN = 12;              // "https://a.co"
    uint256 public constant MAX_URL_LEN = 256;
    uint256 public constant MAX_BIO_LEN = 280;

    IReckonCore public immutable RECKON_CORE;
    IAgentID public immutable AGENT_ID;

    /// @notice Verified 18-decimal BSC Mainnet stablecoins supported by Binance B402 / x402 v2.
    address public immutable USDT; // Permit2
    address public immutable USDC; // Permit2
    address public immutable USD1; // Native EIP-3009
    address public immutable U;    // Native EIP-3009

    // -------------------------------------------------------------------------
    // Types & Storage
    // -------------------------------------------------------------------------

    struct SignalListing {
        string endpointUrl;
        string bio;
        address paymentToken;
        uint128 priceAtomic;
        uint64 updatedAt;
        bool active;
        bool registered;
    }

    struct ProviderView {
        address agent;
        string handle;
        string endpointUrl;
        string bio;
        address paymentToken;
        uint128 priceAtomic;
        uint64 updatedAt;
        bool listingActive;
        uint256 meanBrier;
        uint256 revealRateBps;
        uint32 competitiveRoundsScored;
    }

    mapping(address => SignalListing) private _listings;
    address[] private _providers;

    // -------------------------------------------------------------------------
    // Events & Errors
    // -------------------------------------------------------------------------

    event SignalRegistered(
        address indexed agent,
        string handle,
        string endpointUrl,
        address indexed paymentToken,
        uint128 priceAtomic
    );

    event SignalDeactivated(address indexed agent);

    error ZeroAddress();
    error InvalidTokenDecimals();
    error NotVerifiedForecaster();
    error UnsupportedPaymentToken();
    error InvalidPrice();
    error InvalidEndpointUrl();
    error BioTooLong();
    error InvalidBioCharacters();
    error NotRegistered();

    // -------------------------------------------------------------------------
    // Constructor (Zero Owner — Fully Immutable)
    // -------------------------------------------------------------------------

    constructor(
        address reckonCore_,
        address usdt_,
        address usdc_,
        address usd1_,
        address u_
    ) {
        if (
            reckonCore_ == address(0) ||
            usdt_ == address(0) ||
            usdc_ == address(0) ||
            usd1_ == address(0) ||
            u_ == address(0)
        ) {
            revert ZeroAddress();
        }
        if (
            IERC20Decimals(usdt_).decimals() != 18 ||
            IERC20Decimals(usdc_).decimals() != 18 ||
            IERC20Decimals(usd1_).decimals() != 18 ||
            IERC20Decimals(u_).decimals() != 18
        ) {
            revert InvalidTokenDecimals();
        }

        RECKON_CORE = IReckonCore(reckonCore_);
        AGENT_ID = IAgentID(RECKON_CORE.AGENT_ID());
        USDT = usdt_;
        USDC = usdc_;
        USD1 = usd1_;
        U = u_;
    }

    // -------------------------------------------------------------------------
    // External State-Changing Functions
    // -------------------------------------------------------------------------

    /// @notice Register or update `msg.sender`'s B402/x402 pay-per-signal endpoint.
    ///         Requires active Agent ID and live `ReckonCore.isVerifiedForecaster(msg.sender)`.
    function registerSignal(
        string calldata endpointUrl,
        uint128 priceAtomic,
        address paymentToken,
        string calldata bio
    ) external {
        if (!RECKON_CORE.isVerifiedForecaster(msg.sender)) revert NotVerifiedForecaster();
        if (!isSupportedToken(paymentToken)) revert UnsupportedPaymentToken();
        if (priceAtomic < MIN_PRICE_ATOMIC || priceAtomic > MAX_PRICE_ATOMIC) revert InvalidPrice();
        if (!_isValidHttpsUrl(endpointUrl)) revert InvalidEndpointUrl();
        _validateBio(bio);

        SignalListing storage l = _listings[msg.sender];
        if (!l.registered) {
            l.registered = true;
            _providers.push(msg.sender);
        }

        l.endpointUrl = endpointUrl;
        l.bio = bio;
        l.paymentToken = paymentToken;
        l.priceAtomic = priceAtomic;
        l.updatedAt = uint64(block.timestamp);
        l.active = true;

        string memory handle = AGENT_ID.handleOf(msg.sender);
        emit SignalRegistered(msg.sender, handle, endpointUrl, paymentToken, priceAtomic);
    }

    /// @notice Voluntarily deactivate `msg.sender`'s signal endpoint at any time.
    function deactivateSignal() external {
        SignalListing storage l = _listings[msg.sender];
        if (!l.registered) revert NotRegistered();
        l.active = false;
        l.updatedAt = uint64(block.timestamp);
        emit SignalDeactivated(msg.sender);
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    function isSupportedToken(address token) public view returns (bool) {
        return token == USDT || token == USDC || token == USD1 || token == U;
    }

    /// @notice Returns true iff the provider opted in AND still satisfies live ReckonCore calibration gates.
    function isListingActive(address agent) public view returns (bool) {
        return _listings[agent].active && RECKON_CORE.isVerifiedForecaster(agent);
    }

    function getListing(address agent) external view returns (SignalListing memory) {
        return _listings[agent];
    }

    function providerCount() external view returns (uint256) {
        return _providers.length;
    }

    /// @notice Overflow-safe paginated read of opt-in signal providers with single-pass live calibration metrics.
    function getProviders(uint256 offset, uint256 limit) external view returns (ProviderView[] memory result) {
        uint256 total = _providers.length;
        if (offset >= total || limit == 0) {
            return new ProviderView[](0);
        }
        uint256 count = limit > total - offset ? total - offset : limit;

        result = new ProviderView[](count);
        for (uint256 i = 0; i < count; ++i) {
            address agent = _providers[offset + i];
            SignalListing storage l = _listings[agent];
            IReckonCore.EffectiveProfile memory eff = RECKON_CORE.getEffectiveProfile(agent);
            result[i] = ProviderView({
                agent: agent,
                handle: AGENT_ID.handleOf(agent),
                endpointUrl: l.endpointUrl,
                bio: l.bio,
                paymentToken: l.paymentToken,
                priceAtomic: l.priceAtomic,
                updatedAt: l.updatedAt,
                listingActive: l.active && eff.isVerified,
                meanBrier: eff.meanBrier,
                revealRateBps: eff.revealRateBps,
                competitiveRoundsScored: eff.competitiveRoundsScored
            });
        }
    }

    // -------------------------------------------------------------------------
    // Internal Helpers
    // -------------------------------------------------------------------------

    /// @dev Enforces HTTPS-only URLs restricted to safe RFC 3986 URI characters `[A-Za-z0-9._~:/?#=&%-+]`
    ///      starting with an alphanumeric host character (blocking userinfo phishing, shell metacharacters,
    ///      quotes, backticks, `$`, `<`, `>`, `\`, and whitespace/control bytes).
    function _isValidHttpsUrl(string calldata url) internal pure returns (bool) {
        bytes calldata b = bytes(url);
        if (b.length < MIN_URL_LEN || b.length > MAX_URL_LEN) return false;
        // Must start with "https://"
        if (
            b[0] != 0x68 || // h
            b[1] != 0x74 || // t
            b[2] != 0x74 || // t
            b[3] != 0x70 || // p
            b[4] != 0x73 || // s
            b[5] != 0x3a || // :
            b[6] != 0x2f || // /
            b[7] != 0x2f    // /
        ) {
            return false;
        }
        // First host byte must be ASCII alphanumeric [A-Za-z0-9]
        if (!_isAlnum(uint8(b[8]))) return false;

        for (uint256 i = 9; i < b.length; ++i) {
            if (!_isSafeUrlByte(uint8(b[i]))) return false;
        }
        return true;
    }

    function _isAlnum(uint8 c) internal pure returns (bool) {
        return (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a);
    }

    function _isSafeUrlByte(uint8 c) internal pure returns (bool) {
        if (_isAlnum(c)) return true;
        return (
            c == 0x2d || // -
            c == 0x2e || // .
            c == 0x5f || // _
            c == 0x7e || // ~
            c == 0x2f || // /
            c == 0x3a || // :
            c == 0x3f || // ?
            c == 0x23 || // #
            c == 0x26 || // &
            c == 0x3d || // =
            c == 0x25 || // %
            c == 0x2b    // +
        );
    }

    /// @dev Rejects length > 280 and ASCII control characters (`0x00..0x1f`, `0x7f`, including `0x1b` ANSI ESC).
    function _validateBio(string calldata bio) internal pure {
        bytes calldata b = bytes(bio);
        if (b.length > MAX_BIO_LEN) revert BioTooLong();
        for (uint256 i = 0; i < b.length; ++i) {
            uint8 c = uint8(b[i]);
            if (c < 0x20 || c == 0x7f) revert InvalidBioCharacters();
        }
    }
}
