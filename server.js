const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const db = {
    members: [],
    savingsAccounts: [],
    loans: [],
    transactions: []
};

async function sendSMSNotification(phone, message) {
    console.log(`SMS to ${phone}: ${message}`);
    return true;
}

function checkRole(allowedRoles) {
    return (req, res, next) => {
        const userRole = req.headers['x-user-role'];
        if (!userRole || !allowedRoles.includes(userRole)) {
            return res.status(403).json({ success: false, message: "অনুমতি নেই।" });
        }
        next();
    };
}

app.post('/api/members', checkRole(['admin', 'manager', 'field_officer']), (req, res) => {
    const { fullName, phone, nid, address } = req.body;
    if (!fullName || !phone) {
        return res.status(400).json({ success: false, message: "নাম ও ফোন নম্বর দিন।" });
    }
    const newMember = { id: db.members.length + 1, fullName, phone, nid, address, status: 'active' };
    db.members.push(newMember);
    db.savingsAccounts.push({ accountId: db.savingsAccounts.length + 1, memberId: newMember.id, balance: 0.00 });
    res.status(201).json({ success: true, message: "সদস্য যোগ হয়েছে।", data: newMember });
});

app.get('/api/members', checkRole(['admin', 'manager', 'field_officer']), (req, res) => {
    res.json({ success: true, count: db.members.length, data: db.members });
});

app.post('/api/savings/deposit', checkRole(['admin', 'manager', 'field_officer']), async (req, res) => {
    const { memberId, amount } = req.body;
    const depositAmount = parseFloat(amount);
    const member = db.members.find(m => m.id === parseInt(memberId));
    const account = db.savingsAccounts.find(a => a.memberId === parseInt(memberId));

    if (!member || !account) {
        return res.status(404).json({ success: false, message: "সদস্য পাওয়া যায়নি।" });
    }

    account.balance += depositAmount;
    const transaction = { id: db.transactions.length + 1, memberId: member.id, type: 'deposit', amount: depositAmount, date: new Date().toISOString() };
    db.transactions.push(transaction);

    await sendSMSNotification(member.phone, `প্রিয় ${member.fullName}, ৳${depositAmount} জমা হয়েছে। বর্তমান সঞ্চয়: ৳${account.balance}।`);

    res.json({
        success: true,
        message: "জমা সফল হয়েছে।",
        receipt: { transactionId: transaction.id, memberName: member.fullName, depositedAmount: depositAmount, currentBalance: account.balance }
    });
});

app.get('/api/reports/financial', checkRole(['admin', 'manager']), (req, res) => {
    const totalDeposits = db.savingsAccounts.reduce((sum, acc) => sum + acc.balance, 0);
    res.json({
        success: true,
        summary: {
            totalActiveMembers: db.members.length,
            totalSavingsBalance: totalDeposits,
            totalLoansDisbursed: 0,
            projectedProfit: 0
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
