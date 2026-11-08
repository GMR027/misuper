/** A drawer page's Material 3 top app bar: the menu button, then the title. */

import { Row } from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  height,
  padding,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { IconButton } from "@/components/m3/buttons";
import { M3Host } from "@/components/m3/host";
import { M3Text } from "@/components/m3/text";
import { t } from "@/lib/i18n";

export function DrawerTopAppBar({
  title,
  onMenu,
}: {
  title: string;
  onMenu: () => void;
}) {
  return (
    <M3Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 4 }}
        modifiers={[fillMaxWidth(), height(64), padding(4, 0, 16, 0)]}
      >
        <IconButton icon="menu" label={t("drawer.open")} onPress={onMenu} />
        <M3Text variant="title" maxLines={1} modifiers={[weight(1)]}>
          {title}
        </M3Text>
      </Row>
    </M3Host>
  );
}
