/**
 * Client document-number service (§44). Implements the domain DocumentNumberService by calling
 * the server-authoritative `reserveDocumentNumber` Cloud Function — the client is NEVER the final
 * authority for issuing a unique number (fixes legacy KL-01). The function reserves atomically in
 * a transaction; this wrapper just forwards the request and surfaces typed errors.
 */
import type {
  DocumentNumberService,
  ReserveNumberRequest,
  ReserveNumberResult,
} from '@hynish/domain';
import { DocumentNumberError } from '@hynish/domain';
import { callable } from '@/lib/firebase/functions';

const reserve = callable<ReserveNumberRequest, ReserveNumberResult>('reserveDocumentNumber');

export const documentNumberService: DocumentNumberService = {
  async reserveNextNumber(request: ReserveNumberRequest): Promise<ReserveNumberResult> {
    try {
      return await reserve(request);
    } catch (err) {
      throw new DocumentNumberError('Could not reserve a document number. Please try again.', {
        cause: err instanceof Error ? err.message : 'unknown',
      });
    }
  },
};
