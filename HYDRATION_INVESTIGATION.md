# Chrome on iOS hydration warning investigation

## Conclusion

The supplied device warning identifies a browser-added attribute on the existing search input, not a demonstrated server/client rendering defect in the application. Leave application code unchanged.

The relevant React diff is:

```diff
<input
  id="person-search"
  type="search"
  placeholder="Search a name…"
  value=""
- __gcruniqueid="1"
>
```

Chromium's iOS autofill implementation defines `UNIQUE_ID_ATTRIBUTE` as `__gCrUniqueID`. Its `setUniqueIDIfNeeded` function calls `element.setAttribute(UNIQUE_ID_ATTRIBUTE, elementID.toString())` to store a form/field identifier in the DOM. HTML normalizes this attribute name to lowercase, matching `__gcruniqueid` in the user's diff. The browser-modified DOM therefore contains an attribute that neither the server markup nor React's client props requested.

Primary sources:

- [Chromium iOS autofill attribute definition](https://github.com/chromium/chromium/blob/main/components/autofill/ios/form_util/resources/fill_constants.ts)
- [Chromium iOS autofill attribute insertion](https://github.com/chromium/chromium/blob/main/components/autofill/ios/form_util/resources/renderer_id.ts)
- [Related Next.js iOS Chrome/Edge report](https://github.com/vercel/next.js/issues/77710), which shows an older `__gchrome_uniqueid` spelling and reports no issue in Safari.

This is built-in browser code; it does not require an installed extension. The generic React warning's extension suggestion should not be taken as proof of an extension. Persistence in Chrome Incognito is consistent with the identified mechanism.

## Evidence and application review

The user reports no warning on Mac refresh or physical iPhone Safari, but a warning on physical iPhone Chrome refresh in both normal and Incognito modes. Functionality remains correct in all cases. The supplied attribute-only diff locates the discrepancy specifically at `#person-search`.

Reviewed root layout, page, FamilyExplorer, GraphCanvas, graph service/query and domain display helpers:

- No application source emits `__gCrUniqueID`, `__gcruniqueid`, or `__gchrome_uniqueid`.
- The input starts with the same fixed empty query and no selected Person on server and client.
- The server passes a serialized display graph snapshot to the client; hydration does not independently fetch a different graph.
- Cytoscape is dynamically loaded with SSR disabled. Its positions, force-layout randomness, browser measurements and effects are outside server-rendered graph markup.
- No time/random-value, browser-storage or user-agent branching was found in the server-rendered explorer UI.
- Domain name sorting uses locale-sensitive comparison. That could merit investigation if a future report shows differing text/order, but it does not explain this attribute-only diff and was not changed speculatively.
- No invalid nesting causing this reported input attribute discrepancy was identified.

## Local diagnostics

A temporary loopback development server was used with the existing database; no import/reset or application write occurred.

- Desktop Chromium: initial load plus two refreshes; zero hydration warnings; search remained interactive.
- Chromium with iPhone viewport/device emulation: initial load plus two refreshes; zero hydration warnings; search remained interactive.
- These are not physical Chrome-on-iOS tests and do not include its native autofill injection layer.
- An additional browser-only HTML attribute-injection control was attempted. It did not produce a conclusive hydration result: the routed response did not reach the expected interactive canvas state and a subsequent attempt logged a local-network WebSocket access error. It is not counted as a reproduction. The conclusion rests on the actual supplied device diff and the matching Chromium source, not on this simulation.

The temporary diagnostic server was stopped afterward.

## Changes and limitations

Only this investigation document was added. Application code, configuration, dependencies, tests and data were not changed. The preexisting untracked `next.config.js` was preserved. No `suppressHydrationWarning`, attribute stripping, delayed-render workaround or metadata change was added. No commit, push or merge was performed.

No application defect was established, so no code-fix lint/test/production-build cycle was necessary or run for this investigation.

The exact iOS/Chrome versions and a direct trace of the browser's attribute insertion timing were not provided. The diagnostic evidence identifies the attribute's browser source but does not establish which releases or timing conditions trigger it. The warning may remain in affected Chrome-on-iOS refreshes. Reinvestigate if a later warning shows changed text, different application-owned attributes, or functional problems; those would be separate evidence.
