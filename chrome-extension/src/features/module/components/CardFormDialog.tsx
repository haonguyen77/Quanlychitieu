import { useState } from 'react';
import { useRecordStore } from '@/core/store/recordStore';
import { Icon } from '@/shared/components/ui/Icon';

interface CardFormDialogProps {
  onClose: () => void;
  editRecord?: { id: string; values: Record<string, unknown> } | null;
}

/**
 * Card Management Form - only card info fields:
 * Tên thẻ, Ngân hàng, 4 số cuối, Hạn mức, Ngày sao kê, Ngày thanh toán, Ghi chú
 */
export function CardFormDialog({ onClose, editRecord }: CardFormDialogProps) {
  const { addRecord, updateRecord } = useRecordStore();
  const isEditing = !!editRecord;

  const [cardName, setCardName] = useState(editRecord ? String(editRecord.values['mod_creditcard_card_name'] ?? '') : '');
  const [bankName, setBankName] = useState(editRecord ? String(editRecord.values['mod_creditcard_bank_name'] ?? '') : '');
  const [last4, setLast4] = useState(editRecord ? String(editRecord.values['mod_creditcard_last4'] ?? '') : '');
  const [creditLimit, setCreditLimit] = useState(editRecord ? String(editRecord.values['mod_creditcard_credit_limit'] ?? '') : '');
  const [statementDay, setStatementDay] = useState(editRecord ? String(editRecord.values['mod_creditcard_statement_day'] ?? '20') : '20');
  const [paymentDay, setPaymentDay] = useState(editRecord ? String(editRecord.values['mod_creditcard_payment_due_day'] ?? '10') : '10');
  const [note, setNote] = useState(editRecord ? String(editRecord.values['mod_creditcard_note'] ?? '') : '');

  const handleSave = () => {
    if (!cardName.trim()) return;

    const values = {
      mod_creditcard_card_name: cardName.trim(),
      mod_creditcard_bank_name: bankName.trim(),
      mod_creditcard_last4: last4.trim(),
      mod_creditcard_credit_limit: Number(creditLimit.replace(/[^\d]/g, '')) || 0,
      mod_creditcard_statement_day: Number(statementDay) || 20,
      mod_creditcard_payment_due_day: Number(paymentDay) || 10,
      mod_creditcard_note: note.trim(),
    };

    if (isEditing) {
      updateRecord(editRecord!.id, values);
    } else {
      addRecord('mod_creditcard', values);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isEditing ? 'Sửa thẻ' : 'Thêm thẻ mới'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="x" size={18} /></button>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Tên thẻ *</label>
            <input type="text" value={cardName} onChange={(e) => setCardName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              placeholder="VD: Visa TPBank" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Ngân hàng</label>
            <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              placeholder="VD: TPBank, VPBank..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">4 số cuối</label>
              <input type="text" value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                placeholder="1234" maxLength={4} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Hạn mức</label>
              <input type="text" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value.replace(/[^\d]/g, ''))}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                placeholder="50000000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Ngày sao kê</label>
              <input type="number" value={statementDay} onChange={(e) => setStatementDay(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                min="1" max="31" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Ngày thanh toán</label>
              <input type="number" value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                min="1" max="31" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Ghi chú</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full h-16 px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              placeholder="Ghi chú..." />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">Hủy</button>
          <button onClick={handleSave} className="flex-1 h-10 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
            {isEditing ? 'Cập nhật' : 'Thêm thẻ'}
          </button>
        </div>
      </div>
    </div>
  );
}
