import { describe, it, expect } from 'vitest';
import { parseAmountText, findAmounts, findAllNumbers } from '../src/lib/amount.js';

describe('Amount Parsing and Currency Extraction (amount.js)', () => {
  describe('Required Test Cases & Supported Formats', () => {
    it('1. parses "₹500" -> 50000 paise, currency INR', () => {
      expect(parseAmountText('₹500')).toEqual({ paise: 50000, currency: 'INR' });
    });

    it('2. parses Indian commas "Rs. 1,00,000" -> 10000000 paise, currency INR', () => {
      expect(parseAmountText('Rs. 1,00,000')).toEqual({ paise: 10000000, currency: 'INR' });
    });

    it('3. parses multiplier "2.5k" -> 250000 paise, currency null', () => {
      expect(parseAmountText('2.5k')).toEqual({ paise: 250000, currency: null });
    });

    it('4. parses number words "five hundred rupees" -> 50000 paise, currency INR', () => {
      expect(parseAmountText('five hundred rupees')).toEqual({ paise: 50000, currency: 'INR' });
    });

    it('5. parses "$20" -> 2000 paise, currency USD', () => {
      expect(parseAmountText('$20')).toEqual({ paise: 2000, currency: 'USD' });
    });

    it('6. rejects scientific notation "1e5"', () => {
      expect(parseAmountText('1e5')).toBeNull();
    });

    it('7. rejects negative numbers "-500"', () => {
      expect(parseAmountText('-500')).toBeNull();
      expect(parseAmountText('-₹500')).toBeNull();
    });

    it('8. rejects decimals with > 2 places "500.999"', () => {
      expect(parseAmountText('500.999')).toBeNull();
    });

    it('9. rejects zero amounts "0"', () => {
      expect(parseAmountText('0')).toBeNull();
      expect(parseAmountText('₹0')).toBeNull();
      expect(parseAmountText('0.00')).toBeNull();
      expect(parseAmountText('zero rupees')).toBeNull();
    });

    it('10. parses "Rs 500" -> 50000 paise, INR', () => {
      expect(parseAmountText('Rs 500')).toEqual({ paise: 50000, currency: 'INR' });
    });

    it('11. parses "500 INR" -> 50000 paise, INR', () => {
      expect(parseAmountText('500 INR')).toEqual({ paise: 50000, currency: 'INR' });
    });

    it('12. parses "500 rupees" -> 50000 paise, INR', () => {
      expect(parseAmountText('500 rupees')).toEqual({ paise: 50000, currency: 'INR' });
    });

    it('13. parses "500 rs" -> 50000 paise, INR', () => {
      expect(parseAmountText('500 rs')).toEqual({ paise: 50000, currency: 'INR' });
    });

    it('14. parses "20 dollars" -> 2000 paise, USD', () => {
      expect(parseAmountText('20 dollars')).toEqual({ paise: 2000, currency: 'USD' });
    });

    it('15. parses "USD 100" -> 10000 paise, USD', () => {
      expect(parseAmountText('USD 100')).toEqual({ paise: 10000, currency: 'USD' });
    });

    it('16. parses "50 EUR" -> 5000 paise, EUR', () => {
      expect(parseAmountText('50 EUR')).toEqual({ paise: 5000, currency: 'EUR' });
    });

    it('17. parses "€50" -> 5000 paise, EUR', () => {
      expect(parseAmountText('€50')).toEqual({ paise: 5000, currency: 'EUR' });
    });

    it('18. parses "100 GBP" -> 10000 paise, GBP', () => {
      expect(parseAmountText('100 GBP')).toEqual({ paise: 10000, currency: 'GBP' });
    });

    it('19. parses "£100" -> 10000 paise, GBP', () => {
      expect(parseAmountText('£100')).toEqual({ paise: 10000, currency: 'GBP' });
    });

    it('20. parses Western comma "1,000" -> 100000 paise, currency null', () => {
      expect(parseAmountText('1,000')).toEqual({ paise: 100000, currency: null });
    });

    it('21. parses "10 lakh" -> 100000000 paise, currency null', () => {
      expect(parseAmountText('10 lakh')).toEqual({ paise: 100000000, currency: null });
    });

    it('22. parses "1.5 lakh rupees" -> 15000000 paise, INR', () => {
      expect(parseAmountText('1.5 lakh rupees')).toEqual({ paise: 15000000, currency: 'INR' });
    });

    it('23. parses number words "twenty five" -> 2500 paise, currency null', () => {
      expect(parseAmountText('twenty five')).toEqual({ paise: 2500, currency: null });
    });

    it('24. parses number words "two thousand five hundred" -> 250000 paise, currency null', () => {
      expect(parseAmountText('two thousand five hundred')).toEqual({ paise: 250000, currency: null });
    });

    it('25. rejects hex format "0x10"', () => {
      expect(parseAmountText('0x10')).toBeNull();
    });

    it('26. rejects amounts with more than 12 integer digits', () => {
      expect(parseAmountText('10000000000000')).toBeNull();
    });

    it('27. parses decimals with 1 or 2 places accurately in paise', () => {
      expect(parseAmountText('50.5')).toEqual({ paise: 5050, currency: null });
      expect(parseAmountText('50.05')).toEqual({ paise: 5005, currency: null });
      expect(parseAmountText('₹10.99')).toEqual({ paise: 1099, currency: 'INR' });
    });

    it('28. handles hyphenated words "twenty-five rupees"', () => {
      expect(parseAmountText('twenty-five rupees')).toEqual({ paise: 2500, currency: 'INR' });
    });
  });

  describe('findAmounts(text) in sentence context', () => {
    it('locates and extracts amounts with character spans', () => {
      const text = 'Please transfer ₹500 to Rahul and Rs. 1,000 to Amit';
      const amounts = findAmounts(text);

      expect(amounts).toHaveLength(2);
      expect(amounts[0]).toEqual({
        text: '₹500',
        paise: 50000,
        currency: 'INR',
        start: 16,
        end: 20
      });
      expect(amounts[1]).toEqual({
        text: 'Rs. 1,000',
        paise: 100000,
        currency: 'INR',
        start: 34,
        end: 43
      });
    });

    it('ignores negative numbers and invalid notation in sentences', () => {
      const text = 'Transfer -500 or 1e5 or 0 to Rahul';
      const amounts = findAmounts(text);
      expect(amounts).toHaveLength(0);
    });

    it('finds written numbers like "five hundred rupees"', () => {
      const text = 'Send five hundred rupees to Priya';
      const amounts = findAmounts(text);
      expect(amounts).toHaveLength(1);
      expect(amounts[0].paise).toBe(50000);
      expect(amounts[0].currency).toBe('INR');
      expect(amounts[0].text).toBe('five hundred rupees');
    });
  });

  describe('findAllNumbers(text)', () => {
    it('returns all numeric tokens in the text', () => {
      const text = 'Transfer 500 to account 1001 for reason 0x10 with 2.5k';
      const numbers = findAllNumbers(text);

      expect(numbers.map((n) => n.text)).toEqual(['500', '1001', '0x10', '2.5k']);
      expect(numbers[0]).toHaveProperty('start');
      expect(numbers[0]).toHaveProperty('end');
    });
  });
});
