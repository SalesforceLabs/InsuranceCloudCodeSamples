# SLDS 2 Empty State illustrations

This folder holds the 16 official Cosmos illustrations used by
`<c-empty-state>` for the app's empty and error states.

Source: [Lightning Design System - Empty State](https://www.lightningdesignsystem.com/2e1ef8501/p/09f001-empty-state)

## Contents

- `<set>-<symbol>.svg` - the raw asset per official code (16 files).
- `illustrations.js` - auto-generated manifest that maps every
  `set:symbol` code to a `data:image/svg+xml;base64,…` URI so the
  bundle stays self-contained under `vite-plugin-singlefile`.

## Codes → SVG

| Code (`set:symbol`)      | File                        |
|--------------------------|-----------------------------|
| `error:unrecoverable`    | `error-unrecoverable.svg`   |
| `error:recoverable`      | `error-recoverable.svg`     |
| `error:connectionissue`  | `error-connectionissue.svg` |
| `error:appconnection`    | `error-appconnection.svg`   |
| `maintenance:planned`    | `maintenance-planned.svg`   |
| `maintenance:unplanned`  | `maintenance-unplanned.svg` |
| `cart:noitems`           | `cart-noitems.svg`          |
| `noresults:search`       | `noresults-search.svg`      |
| `noresults:filter`       | `noresults-filter.svg`      |
| `noresults:unknown`      | `noresults-unknown.svg`     |
| `success:selfassigned`   | `success-selfassigned.svg`  |
| `success:assigned`       | `success-assigned.svg`      |
| `success:new`            | `success-new.svg`           |
| `accessissues:request`   | `accessissues-request.svg`  |
| `accessissues:limit`     | `accessissues-limit.svg`    |
| `accessissues:deleted`   | `accessissues-deleted.svg`  |

## Adding or replacing an asset

1. Download the SVG from LDS (`https://www.lightningdesignsystem.com/uploads/<id>.svg`)
   into this folder, keeping the `<set>-<symbol>.svg` file name.
2. Regenerate the manifest (see below).
3. Import the new code from `<c-empty-state>` via
   `illustration-name="set:symbol"`.

## Regenerating `illustrations.js`

Run this from the workspace root:

```bash
cd cumulus-app/src/assets/illustrations/slds2 && {
  echo "// AUTO-GENERATED. Do not edit by hand."
  echo "// Source: https://www.lightningdesignsystem.com Empty State (SLDS 2 Cosmos)"
  echo "// Regenerate: see cumulus-app/src/assets/illustrations/slds2/README.md"
  echo ""
  echo "export const ILLUSTRATIONS = {"
  for f in *.svg; do
    name=$(basename "$f" .svg)
    code=$(echo "$name" | sed 's/-/:/')
    b64=$(base64 -i "$f" | tr -d '\n')
    echo "  '$code': 'data:image/svg+xml;base64,$b64',"
  done
  echo "};"
  echo ""
  echo "export const ILLUSTRATION_CODES = Object.freeze(Object.keys(ILLUSTRATIONS));"
} > illustrations.js
```

The manifest is consumed by `c/emptyState` via a relative import,
so any code added here becomes available immediately as
`illustration-name="<set>:<symbol>"`.
