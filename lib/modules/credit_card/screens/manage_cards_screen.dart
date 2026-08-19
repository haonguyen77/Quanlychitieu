import 'package:flutter/material.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:provider/provider.dart';
import '../models/credit_card.dart';
import '../providers/credit_card_provider.dart';
import 'add_credit_card_screen.dart';

/// Screen showing list of credit cards with option to add new ones.
class ManageCardsScreen extends StatefulWidget {
  const ManageCardsScreen({super.key});

  @override
  State<ManageCardsScreen> createState() => _ManageCardsScreenState();
}

class _ManageCardsScreenState extends State<ManageCardsScreen> {
  static const _purple = Color(0xFF6C2BD9);
  static const _navy = Color(0xFF101B4D);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CreditCardProvider>().loadCards();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Quản lý thẻ')),
      body: Consumer<CreditCardProvider>(
        builder: (context, provider, _) {
          if (provider.cards.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.credit_card_off, size: 48, color: Colors.grey[300]),
                  const SizedBox(height: 12),
                  Text('Chưa có thẻ nào', style: TextStyle(color: Colors.grey[500])),
                ],
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: provider.cards.length,
            itemBuilder: (context, index) {
              final card = provider.cards[index];
              return _buildCardTile(card);
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _addCard(),
        backgroundColor: _purple,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Thêm thẻ', style: TextStyle(color: Colors.white)),
      ),
    );
  }

  Widget _buildCardTile(CreditCard card) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Slidable(
        key: ValueKey(card.id),
        endActionPane: ActionPane(
          motion: const DrawerMotion(),
          extentRatio: 0.25,
          children: [
            SlidableAction(
              onPressed: (_) => _confirmDeleteCard(card),
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
              icon: Icons.delete,
              label: 'Xóa',
              borderRadius: const BorderRadius.horizontal(right: Radius.circular(12)),
            ),
          ],
        ),
        child: Card(
          margin: EdgeInsets.zero,
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: _purple.withOpacity(0.1),
              child: const Icon(Icons.credit_card, color: _purple),
            ),
            title: Text(card.name, style: const TextStyle(fontWeight: FontWeight.w600, color: _navy)),
            subtitle: Text('${card.bankName ?? ""} ${card.last4 != null ? "•••• ${card.last4}" : ""}'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _showCardDetail(card),
          ),
        ),
      ),
    );
  }

  void _showCardDetail(CreditCard card) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Handle
                Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)))),
                const SizedBox(height: 16),
                // Card info
                Row(
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: _purple.withOpacity(0.1),
                      child: const Icon(Icons.credit_card, color: _purple, size: 24),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(card.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _navy)),
                        if (card.bankName != null) Text(card.bankName!, style: TextStyle(fontSize: 14, color: Colors.grey[600])),
                        if (card.last4 != null) Text('•••• ${card.last4}', style: TextStyle(fontSize: 13, color: Colors.grey[500])),
                      ]),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                // Actions
                ListTile(
                  leading: const Icon(Icons.edit_outlined, color: _purple),
                  title: const Text('Sửa thông tin thẻ'),
                  onTap: () {
                    Navigator.pop(ctx);
                    _editCard(card);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.delete_outline, color: Colors.red),
                  title: const Text('Xóa thẻ và giao dịch', style: TextStyle(color: Colors.red)),
                  onTap: () {
                    Navigator.pop(ctx);
                    _confirmDeleteCard(card);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _confirmDeleteCard(CreditCard card) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa thẻ tín dụng'),
        content: Text('Bạn có chắc muốn xóa thẻ "${card.name}"?\n\nThẻ và các giao dịch liên quan sẽ bị ẩn.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await context.read<CreditCardProvider>().deleteCard(card.id);
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
  }

  void _addCard() {
    Navigator.push(context, MaterialPageRoute(builder: (_) => const AddCreditCardScreen()))
        .then((_) => context.read<CreditCardProvider>().loadCards());
  }

  void _editCard(CreditCard card) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => AddCreditCardScreen(editCard: card)))
        .then((_) => context.read<CreditCardProvider>().loadCards());
  }
}
