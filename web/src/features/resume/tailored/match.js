/** "5 of 7 requirements", or a plain note when the posting listed none. */
export const matchLine = (covered, total) => (total === 0 ? 'No requirements listed' : `${covered} of ${total} requirements`)

const KIND_LABELS = { reword: 'Reworded', trim: 'Removed', reorder: 'Reordered' }
export const kindLabel = (kind) => KIND_LABELS[kind] ?? 'Changed'
