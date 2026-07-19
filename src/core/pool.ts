export async function mapWithConcurrency<Input, Output>(
  items: Input[],
  limit: number,
  worker: (item: Input, index: number) => Promise<Output>,
): Promise<Output[]> {
  if (items.length === 0) return [];

  const results = new Array<Output>(items.length);
  const workerCount = Math.min(items.length, Math.max(1, Math.floor(limit)));
  let nextIndex = 0;

  const run = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]!, index);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, run));
  return results;
}
