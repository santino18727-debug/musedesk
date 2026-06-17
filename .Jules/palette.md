## 2024-06-08 - Accessible click targets for sliders
**Learning:** Using semantic `<label for="...">` instead of `<span>` next to range sliders significantly increases the usable click area, making them much easier to tap on touch screens while also fixing screen reader announcements. Inputs also need explicit `aria-label` when they only have placeholders.
**Action:** Always wrap plain text descriptors of inputs/sliders in semantic `<label>` tags and ensure icon-only search inputs have explicit `aria-label` attributes.
