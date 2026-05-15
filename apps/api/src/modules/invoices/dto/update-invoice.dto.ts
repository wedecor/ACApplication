import { PartialType } from '@nestjs/swagger';

import { CreateInvoiceDto } from './create-invoice.dto';

/**
 * Editing an invoice is heavily restricted post-issue. The service layer
 * enforces:
 *   • only DRAFT invoices may have line items / totals mutated;
 *   • SENT/PARTIALLY_PAID invoices accept only `notes` and `dueDate`.
 */
export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {}
