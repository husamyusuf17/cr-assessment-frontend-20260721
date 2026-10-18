# Implementation Notes

## 1. What I changed

- Fixed the line-item diff logic so changes to description, quantity, or unit price are classified as `changed`, while added, removed, and unchanged items are handled correctly.
- Completed the Change Request list status filter and added clear loading, loaded, empty, filtered-empty, and error behavior.
- Completed the Change Request detail review flow, including chronological timeline ordering, totals and delta display, and a diff preview that shows descriptions, quantities, and prices.
- Added permission- and status-aware Approve and Reject behavior so actions are only available for a `PENDING_APPROVAL` CR when the current user has the required approval policy.
- Implemented Approve and Reject API flows with duplicate-submission protection, action-error handling, and rejection-reason validation.
- Expanded the Jest/TestBed test suite to cover rendered behavior, permissions, validation, loading/error states, slow requests, action success/failure, timeline ordering, totals, and diff rendering.

## 2. Component & state model

The application has two main reviewer screens: a Change Request list and a Change Request detail view. `CrListComponent` loads organization-scoped CR summaries from `CrApiService`, stores the result in an explicit `ViewState<CrSummary[]>`, and derives `visibleRows` from the loaded data and the selected status filter. The template renders different UI for loading, API-empty, filtered-empty, loaded, and error conditions.

`CrDetailComponent` loads a single CR into `ViewState<CrDetail>`. The component derives the diff, chronological timeline, and permission-aware action availability from the loaded detail instead of storing duplicate derived state. Approve and Reject use the mock API as the source of truth: when an action succeeds, the returned updated CR replaces the currently loaded detail; when it fails, the existing detail remains visible and an action-level error is shown.

## 3. Invariants I keep

| Invariant                                                                    | How / where                                                                                                                        |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A user only sees CR data from their organization                             | Enforced by the supplied `CrApiService` contract and the current `SessionService` user.                                            |
| `ALL` shows every loaded CR and a selected status shows only matching rows   | Enforced by `CrListComponent.visibleRows`.                                                                                         |
| API-empty and filtered-empty are different UI states                         | API-empty uses `state.status === 'empty'`; filtered-empty is derived from `state.status === 'loaded' && visibleRows.length === 0`. |
| Diff rows correctly distinguish added, removed, changed, and unchanged items | Enforced by `computeDiff()` and its unit tests.                                                                                    |
| SKU is treated as the line-item identity                                     | The diff maps baseline/proposed items by SKU and compares the mutable fields after matching.                                       |
| Timeline entries render oldest first                                         | `timeline` sorts a copy of the audit array by timestamp so the API data is not mutated.                                            |
| Review actions require both the correct CR status and user permission        | `canApprove` and `canReject` require `PENDING_APPROVAL` and `canApprovePolicy(session.user)`.                                      |
| A read-only user cannot perform review actions                               | Approve is hidden and disabled, and Reject is not rendered when permission checks fail.                                            |
| A rejection requires meaningful text                                         | `rejectControl` uses `Validators.required` and `Validators.pattern(/\S/)`.                                                         |
| Only one action request can be submitted at a time                           | `submitting` disables the controls and the action methods also guard against duplicate calls.                                      |
| A failed action does not falsely change the displayed CR state               | Component state is replaced only after the API returns successfully; failures populate `actionError`.                              |
| User-entered rejection text is preserved when rejection fails                | The rejection control is reset only after a successful API response.                                                               |

## 4. Testing strategy

I used both pure unit tests and rendered component tests.

`diff.spec.ts` tests the pure diff logic independently, including added, removed, changed, and unchanged cases. Component tests use Angular TestBed and query the rendered DOM because the main goal of the exercise is correct user-visible behavior rather than only correct internal values.

The list tests cover loaded rows, API-empty state, loading, errors, status filtering, and a filter with no matching results. The detail tests cover title rendering, totals/delta, description changes in the diff, chronological timeline ordering, read-only permissions, non-pending CRs, rejection validation, successful Approve/Reject flows, slow-request duplicate prevention, action failures, initial loading, and initial load errors.

The final suite contains 26 passing tests across the diff, list, and detail specifications. I also ran `npm run typecheck`, `npm run lint`, `npm run build`, and the full `npm test` suite successfully.

## 5. Assumptions and judgment calls

I treated SKU as the stable identity of a line item. After matching by SKU, changes to description, quantity, or unit price make the row `changed`.

I treated Reject as part of the same approval decision capability as Approve because the supplied permissions expose approval policies but no separate rejection policy. Therefore both actions use `canApprovePolicy()` in addition to the CR status check.

I kept filtering as derived view state instead of modifying the loaded API data. This keeps the original result available when the user switches between filters.

For an unavailable Approve action, I keep the button in the DOM but hide and disable it when `canApprove` is false. This avoids visually offering an unauthorized action while preserving a stable element for the supplied rendered test. Reject uses conditional rendering because its complete reason-entry UI should not be shown when rejection is unavailable.

I sort a copied audit array instead of calling `.sort()` directly on the API-provided audit array because getters should not introduce unexpected mutation.

## 6. Where I used AI

I used AI as a development assistant during the assessment, mainly to review implementation decisions, reason through failing tests and edge cases, and identify additional scenarios worth covering in the test suite.

I implemented and validated the changes incrementally in the existing Angular architecture, reviewed the component state, template behavior, permission logic, and reactive-form validation myself, and ran the focused and full test suites after each milestone. AI was only used as a review and reasoning aid rather than as a replacement for understanding or ownership of the implementation.

## 7. What I'd improve with more time

With more time I would add more accessibility-focused behavior, including clearer focus management after errors and action completion, stronger semantic labelling, and keyboard-focused testing.

I would also consider extracting repeated action-state behavior if the workflow gained additional reviewer actions, while avoiding unnecessary abstraction for the current small scope. For a production HTTP-backed version I would review cancellation, stale-response handling, server-side authorization responses, telemetry, and end-to-end tests in addition to the current component-level coverage.
