/** Material 3 feedback: progress, spinners, badges and dividers. */

import {
  Badge as ComposeBadge,
  CircularProgressIndicator,
  LinearProgressIndicator,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  size,
} from "@expo/ui/jetpack-compose/modifiers";
import { useTheme } from "@/components/theme";
import { Compose } from "@/components/m3/host";
import { M3Text } from "@/components/m3/text";

/** Material 3 draws a "stop indicator" dot at a track's end; at 0 % it is a stray dot. */
const NO_STOP_INDICATOR = { stopSize: 0 } as const;

/** A determinate linear bar; `fraction` 0..1, or null while it is not known. */
export function ProgressBar({ fraction }: { fraction: number | null }) {
  const { colors } = useTheme();
  return (
    <Compose matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <LinearProgressIndicator
        progress={fraction === null ? null : Math.min(1, Math.max(0, fraction))}
        color={colors.accent}
        trackColor={colors.surface2}
        drawStopIndicator={NO_STOP_INDICATOR}
        modifiers={[fillMaxWidth()]}
      />
    </Compose>
  );
}

/** A small circular spinner. */
export function Spinner() {
  const { colors } = useTheme();
  return (
    <Compose>
      <CircularProgressIndicator
        strokeWidth={2}
        color={colors.accentMark}
        modifiers={[size(20, 20)]}
      />
    </Compose>
  );
}

export type BadgeKind = "primary" | "neutral" | "success" | "warning" | "error";

/** A short pill of text (Ticket, este mes): a tint of the kind's colour. */
export function Badge({
  children,
  kind = "primary",
}: {
  children: string;
  kind?: BadgeKind;
}) {
  const { colors } = useTheme();
  const tone = {
    primary: colors.accent,
    neutral: colors.muted,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
  }[kind];
  return (
    <Compose>
      <ComposeBadge containerColor={`${tone}26`} contentColor={tone}>
        <M3Text variant="caption" weight="600" color={null} maxLines={1}>
          {children}
        </M3Text>
      </ComposeBadge>
    </Compose>
  );
}
