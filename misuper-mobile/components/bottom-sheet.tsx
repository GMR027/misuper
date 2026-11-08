/** A Material 3 modal bottom sheet, drawn with Jetpack Compose. */

import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Column,
  ModalBottomSheet,
  type ModalBottomSheetRef,
  Row,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  padding,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useTheme } from "@/components/theme";
import { IconButton } from "@/components/m3/buttons";
import { Compose } from "@/components/m3/host";
import { M3Text } from "@/components/m3/text";
import { t } from "@/lib/i18n";

/**
 * A bottom sheet with a title, close button, optional header/actions and a
 * scrolling body. `visible` false slides it away before it unmounts, so the
 * parent only flips the flag.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  actions,
  header,
  footer,
  skipPartiallyExpanded = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  /** Open full height instead of Compose's half-expanded state. */
  skipPartiallyExpanded?: boolean;
}) {
  const { colors } = useTheme();
  const sheet = useRef<ModalBottomSheetRef>(null);
  const [mounted, setMounted] = useState(visible);

  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible || !mounted) return;
    const ref = sheet.current;
    if (!ref) {
      setMounted(false);
      return;
    }
    void ref.hide().finally(() => setMounted(false));
  }, [visible, mounted]);

  if (!mounted) return null;

  return (
    <Compose style={{ position: "absolute" }}>
      <ModalBottomSheet
        ref={sheet}
        onDismissRequest={() => {
          setMounted(false);
          onClose();
        }}
        containerColor={colors.surface}
        contentColor={colors.foreground}
        skipPartiallyExpanded={skipPartiallyExpanded}
        initialFullyExpanded={skipPartiallyExpanded}
        showDragHandle
      >
        <Column modifiers={[fillMaxWidth(), padding(0, 0, 0, 16)]}>
          <Row
            verticalAlignment="center"
            modifiers={[fillMaxWidth(), padding(24, 0, 12, 8)]}
          >
            <M3Text variant="subtitle" modifiers={[weight(1)]}>
              {title}
            </M3Text>
            {actions}
            <IconButton
              icon="close"
              label={t("common.close")}
              onPress={onClose}
            />
          </Row>
          {header}
          <Column modifiers={[fillMaxWidth(), weight(1), verticalScroll()]}>
            {children}
          </Column>
          {footer ? (
            <Column modifiers={[padding(16, 8, 16, 0)]}>{footer}</Column>
          ) : null}
        </Column>
      </ModalBottomSheet>
    </Compose>
  );
}
