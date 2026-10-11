import { Router } from 'express';
import { getBank } from '../lib/mockBank.js';
import { getUserId } from '../middleware/session.js';

export const bankRouter = Router();

bankRouter.get('/account', (req, res) => {
  const userId = getUserId(req);
  const bank = getBank(userId);

  res.status(200).json({
    user: bank.user,
    account_id: bank.account_id,
    balance_paise: bank.balance_paise,
    contacts: bank.contacts,
    history: bank.history
  });
});
