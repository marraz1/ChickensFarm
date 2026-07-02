// Domain error types shared by the service layer and mapped to HTTP status
// codes by handleApiError. Kept free of framework imports so services can throw
// them without pulling in next/server.

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Raised when an optimistic-concurrency guard detects that a row changed
// underneath a read-modify-write (e.g. two simultaneous losses on one group).
export class ConcurrentModificationError extends Error {
  constructor(message = "Įrašas ką tik pasikeitė, bandykite dar kartą") {
    super(message);
    this.name = "ConcurrentModificationError";
  }
}
