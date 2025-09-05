export async function getDecisionForConflict(conflict) {
  if (!conflict || !Array.isArray(conflict.contenders) || conflict.contenders.length === 0) {
    throw new Error("Invalid conflict object");
  }

  // Sort contenders by priority (descending)
  const sorted = [...conflict.contenders].sort((a, b) => b.priority - a.priority);

  const winner = sorted[0].train_no;
  const losers = sorted.slice(1).map(train => train.train_no);

  return { winner, losers };
}
