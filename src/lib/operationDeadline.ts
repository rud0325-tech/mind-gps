export class OperationUnconfirmedError extends Error {
  constructor() {
    super('저장 완료를 아직 확인하지 못했어요. 도움이 필요하면 선생님께 직접 알려 주세요. 요청이 나중에 반영될 수 있어요.');
    this.name = 'OperationUnconfirmedError';
  }
}

// A deadline stops waiting; it cannot cancel an already submitted Firestore write.
export async function withOperationDeadline<T>(
  operation: Promise<T>,
  timeoutMs = 15000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new OperationUnconfirmedError()), timeoutMs);
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
