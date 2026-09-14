import { Palette } from "lucide-react";
import { themeSchema, themes } from "../scene/themes";
import type { ThemeId } from "../scene/themes";
export function ThemePicker({
  theme,
  onChange,
}: {
  readonly theme: ThemeId;
  readonly onChange: (theme: ThemeId) => void;
}) {
  return (
    <label className="theme-picker">
      <Palette size={15} />
      <span>Theme</span>
      <select
        aria-label="Theme"
        value={theme}
        onChange={(event) => {
          const value = event.currentTarget.value;
          const parsed=themeSchema.safeParse(value); if(parsed.success)onChange(parsed.data);
        }}
      >
        {Object.entries(themes).map(([id, value]) => (
          <option key={id} value={id}>
            {value.name}
          </option>
        ))}
      </select>
    </label>
  );
}
