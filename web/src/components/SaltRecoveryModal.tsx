"use client";

import { useState } from "react";
import { Check, Copy, DownloadSimple, Key, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { FEEDS, STAKE_TIERS } from "@/lib/reckon/constants";
import { encodeRecoveryToken, type SaltRecoveryRecord } from "@/lib/reckon/commitment";
import { downloadSaltJsonFile } from "@/lib/salts-browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface SaltRecoveryModalProps {
  record: SaltRecoveryRecord;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirmSign: () => void;
}

export function SaltRecoveryModal({
  record,
  isSubmitting,
  onCancel,
  onConfirmSign,
}: SaltRecoveryModalProps) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const recoveryToken = encodeRecoveryToken(record);
  const feed = FEEDS[record.feedId] ?? FEEDS[0];
  const tier = STAKE_TIERS[record.tierId] ?? STAKE_TIERS[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryToken);
      setCopied(true);
      toast.success("Recovery string copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not access clipboard");
    }
  };

  const handleDownload = () => {
    downloadSaltJsonFile(record);
    setDownloaded(true);
    toast.success(`Saved reckon-salt-epoch-${record.epochId}.json`);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="warning">
              <Key size={11} weight="duotone" />
              Salt backup required
            </Badge>
          </div>
          <DialogTitle className="mt-1">Back up commit secret before signing</DialogTitle>
          <DialogDescription>
            Reckon never stores your probability or salt. Losing this secret makes it impossible to reveal after{" "}
            <code className="font-mono text-foreground">resolveTime</code>, forfeiting{" "}
            <strong className="text-foreground">{tier.stakeBnb} BNB</strong> and recording a{" "}
            <code className="font-mono text-destructive">0.0000</code> Brier score.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-background p-3.5 font-mono text-xs tabular-nums">
            <div>
              <div className="text-[10px] text-muted-foreground">Market</div>
              <div className="mt-0.5 font-semibold text-foreground">{feed.symbol}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Epoch · Tier</div>
              <div className="mt-0.5 text-foreground">
                #{record.epochId} · {tier.label}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Forecast probability</div>
              <div className="mt-0.5 font-semibold text-foreground">
                {(record.probBps / 100).toFixed(2)}% ({record.probBps} bps)
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Native stake</div>
              <div className="mt-0.5 font-semibold text-foreground">{tier.stakeBnb} BNB</div>
            </div>
            <div className="col-span-2 border-t border-border pt-2">
              <div className="text-[10px] text-muted-foreground">Commitment hash</div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {record.commitment}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="salt-recovery-token"
              className="block text-xs font-medium text-foreground/90"
            >
              Recovery token (also saved locally in browser storage)
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="salt-recovery-token"
                readOnly
                value={recoveryToken}
                className="font-mono text-[11px]"
              />
              <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
                {copied ? <Check size={14} className="text-foreground" /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="w-full justify-center"
          >
            {downloaded ? (
              <>
                <Check size={14} className="text-foreground" />
                Downloaded reckon-salt-epoch-{record.epochId}.json
              </>
            ) : (
              <>
                <DownloadSimple size={14} />
                Download JSON backup (reckon-salt-epoch-{record.epochId}.json)
              </>
            )}
          </Button>

          <label
            htmlFor="salt-ack-checkbox"
            className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background/70 p-3 text-xs leading-relaxed text-muted-foreground transition-[border-color] duration-150 hover:border-border-strong"
          >
            <Checkbox
              id="salt-ack-checkbox"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
              className="mt-0.5"
            />
            <span>
              I have backed up my recovery token or JSON file and understand that missing the 4-hour reveal window forfeits my {tier.stakeBnb} BNB stake.
            </span>
          </label>
        </div>

        <DialogFooter className="border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={!acknowledged || isSubmitting}
            onClick={onConfirmSign}
          >
            {isSubmitting ? "Waiting for wallet…" : `Sign & Commit ${tier.stakeBnb} BNB`}
          </Button>
        </DialogFooter>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Warning size={13} className="shrink-0 text-foreground/70" />
          <span>Zero ERC-20 approvals. Sent directly to ownerless ReckonCore as native BNB.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
