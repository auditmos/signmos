# Agentic Mode UI/API Capability Matrix

Date: 2026-07-18

Result: 32 UI document actions mapped; 28 of 28 runtime `/api/v1` operations represented; no unmapped row.

All operations require `Authorization: Bearer $SIGNMOS_TOKEN`. “Required; exact replay/conflict” means a fresh `Idempotency-Key` is mandatory for the intended mutation, an identical retry returns the original result, and changed-request reuse returns `IDEMPOTENCY_CONFLICT`.

| Current UI document action | `/api/v1` operation | Required role | Idempotency | OpenAPI operation | `/agent.md` workflow | Named evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Confirm the acting email | `GET /api/v1/me` | Verified identity | Not applicable (read) | `getAgentIdentity` | Confirm identity | `agentic bearer identity` |
| Search/filter/page My Documents | `GET /api/v1/documents` | Creator or signer | Not applicable (read) | `listAgentDocuments` | Discover documents | `agent read-only documents` |
| Start a self-sign draft | `POST /api/v1/documents` | Creator | Required; exact replay/conflict | `createAgentSelfSignDocument` | Create a self-sign draft | `agent self-sign lifecycle`; `agent command idempotency` |
| Start a two-party draft | `POST /api/v1/documents` | Creator | Required; exact replay/conflict | `createAgentSelfSignDocument` | Create a two-party draft | `agent two-party creator`; `agent command idempotency` |
| Resume preparation or review detail | `GET /api/v1/documents/{documentId}` | Creator or signer | Not applicable (read) | `getAgentDocument` | Inspect detail and history | `agent read-only documents`; `agent revision loop` |
| Poll lifecycle and participant state | `GET /api/v1/documents/{documentId}/status` | Creator or signer | Not applicable (read) | `getAgentDocumentStatus` | Poll document status | `agent read-only documents`; `agent measured rate-limit boundaries` |
| View lifecycle history/change comment | `GET /api/v1/documents/{documentId}/history` | Creator or signer | Not applicable (read) | `getAgentDocumentHistory` | Inspect detail and history | `agent revision loop` |
| Download completed signed PDF | `GET /api/v1/documents/{documentId}/pdf` | Creator or signer | Not applicable (read) | `downloadAgentFinalPdf` | Download a completed PDF | `agent self-sign lifecycle`; `agent partner completion` |
| Upload the initial source PDF | `PUT /api/v1/documents/{documentId}/source-pdf` | Creator | Required; exact replay/conflict | `uploadAgentSourcePdf` | Upload one source PDF | `agent self-sign lifecycle`; `agent command idempotency` |
| Upload a requested revision | `PUT /api/v1/documents/{documentId}/source-pdf` | Creator | Required; exact replay/conflict | `uploadAgentSourcePdf` | Upload a revision | `agent revision loop` |
| Inspect current source metadata | `GET /api/v1/documents/{documentId}/source-pdf` | Creator or assigned signer | Not applicable (read) | `getAgentSourcePdf` | Review only assigned content | `agent self-sign lifecycle`; `agent partner completion` |
| Download source for preparation/review | `GET /api/v1/documents/{documentId}/source-pdf/content` | Creator or assigned signer | Not applicable (read) | `downloadAgentSourcePdf` | Review only assigned content | `agent self-sign lifecycle`; `agent partner completion` |
| Save typed/drawn signature profile | `POST /api/v1/documents/{documentId}/signature-profiles` | Current signer | Required; exact replay/conflict | `createAgentSignatureProfile` | Save a signature profile | `agent self-sign lifecycle`; `agent command idempotency` |
| Load selected reusable signature | `GET /api/v1/documents/{documentId}/signature-profiles/selected` | Current signer | Not applicable (read) | `getAgentSelectedSignatureProfile` | Save a signature profile | `agent self-sign lifecycle` |
| Review placed fields | `GET /api/v1/documents/{documentId}/fields` | Creator or assigned signer | Not applicable (read) | `listAgentFields` | Prepare both parties | `agent two-party creator`; `agent partner completion` |
| Place explicit signature/date fields | `POST /api/v1/documents/{documentId}/fields` | Creator | Required; exact replay/conflict | `placeAgentFields` | Place signature and date fields | `agent self-sign lifecycle explicit field preparation`; `agent command idempotency` |
| Default-place signature/date fields | `POST /api/v1/documents/{documentId}/fields/defaults` | Creator | Required; exact replay/conflict | `placeAgentDefaultFields` | Place signature and date fields | `agent self-sign lifecycle`; `agent command idempotency` |
| Review own signing task | `GET /api/v1/documents/{documentId}/signing-task` | Assigned signer | Not applicable (read) | `getAgentSigningTask` | Review and reposition | `agent self-sign lifecycle`; `agent partner completion` |
| Reposition an assigned field | `PATCH /api/v1/documents/{documentId}/fields/{fieldId}` | Assigned self-signer | Required; exact replay/conflict | `repositionAgentSigningField` | Review and reposition | `agent self-sign lifecycle`; `agent command idempotency` |
| Complete self/creator/partner signing | `POST /api/v1/documents/{documentId}/complete` | Assigned signer | Required; exact replay/conflict | `completeAgentSigning` | Complete self-signing / Complete partner signing | `agent self-sign lifecycle`; `agent partner completion`; `agent command idempotency` |
| List current recipients | `GET /api/v1/documents/{documentId}/recipients` | Creator | Not applicable (read) | `listAgentRecipients` | Manage draft recipients | `agent two-party creator` |
| Add partner recipients | `POST /api/v1/documents/{documentId}/recipients` | Creator | Required; exact replay/conflict | `addAgentRecipients` | Manage draft recipients | `agent two-party creator`; `agent command idempotency` |
| Edit a partner recipient | `PATCH /api/v1/documents/{documentId}/recipients/{recipientId}` | Creator | Required; exact replay/conflict | `updateAgentRecipient` | Manage draft recipients | `agent two-party creator`; `agent command idempotency` |
| Remove a partner recipient | `DELETE /api/v1/documents/{documentId}/recipients/{recipientId}` | Creator | Required; exact replay/conflict | `deleteAgentRecipient` | Manage draft recipients | `agent two-party creator`; `agent command idempotency` |
| Send prepared partner invitation | `POST /api/v1/documents/{documentId}/send` | Creator | Required; exact replay/conflict | `sendAgentDocument` | Send the partner invitation | `agent two-party creator delivery`; `agent command idempotency` |
| Resend eligible partner invitation | `POST /api/v1/documents/{documentId}/recipients/{recipientId}/resend` | Creator | Required; exact replay/conflict | `resendAgentInvitation` | Resend an eligible invitation | `agent two-party creator delivery`; `agent command idempotency` |
| Request creator changes with comment | `POST /api/v1/documents/{documentId}/change-request` | Assigned partner | Required; exact replay/conflict | `requestAgentSigningChanges` | Request creator changes | `agent partner change request`; `agent revision loop` |
| Decline with reason/comment | `POST /api/v1/documents/{documentId}/decline` | Assigned partner | Required; exact replay/conflict | `declineAgentSigning` | Decline partner signing | `agent partner decline` |
| Cancel an in-flight document | `POST /api/v1/documents/{documentId}/actions` | Creator | Required; exact replay/conflict | `controlAgentDocument` | Cancel or expire | `agent creator controls` |
| Expire an approved active document | `POST /api/v1/documents/{documentId}/actions` | Creator | Required; exact replay/conflict | `controlAgentDocument` | Cancel or expire | `agent creator controls` |
| Delete retained document/artifacts | `POST /api/v1/documents/{documentId}/actions` | Creator | Required; exact replay/conflict | `controlAgentDocument` | Delete and revoke | `agent creator controls` |
| Inspect exact retention eligibility | `GET /api/v1/documents/{documentId}/retention` | Creator | Not applicable (read) | `getAgentDocumentRetention` | Inspect retention | `agent creator controls` |

The matrix includes UI-backed browser actions only; token-management operations remain browser-management-session-only and intentionally have no Bearer API equivalent.
