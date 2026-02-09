
export const EmailService = {
    /**
     * Generates a mailto link for weekly plan reminders and opens it.
     */
    sendWeeklyReminder(emails: string[], weekStart: string) {
        if (emails.length === 0) return;

        const subject = `[重要] 請提交本週 (${weekStart}) 的週計畫`;
        const body = `
各位同仁好，

系統檢查到您尚未提交本週 (${weekStart}) 的週計畫。
請務必於今日完成填寫並提交審核。

連結：${window.location.origin}/weekly-plan

謝謝。
        `.trim();

        this.openMailClient(emails, subject, body);
    },

    /**
     * Generates a mailto link for daily plan reminders and opens it.
     */
    sendDailyReminder(emails: string[], date: string) {
        if (emails.length === 0) return;

        const subject = `[提醒] 請填寫今日 (${date}) 的曉三計畫`;
        const body = `
各位同仁好，

提醒您，今日 (${date}) 的曉三計畫 (Daily Plan) 尚未填寫。
請協助於早上 9:30 前完成。

連結：${window.location.origin}/daily-plan

謝謝。
        `.trim();

        this.openMailClient(emails, subject, body);
    },

    openMailClient(bcc: string[], subject: string, body: string) {
        // Use BCC to protect privacy or avoid massive To list
        // Note: mailto links have length limits (approx 2000 chars), so for many users this might truncate.
        // For a small team (< 50), it usually works.
        const mailtoLink = `mailto:?bcc=${bcc.join(',')}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailtoLink, '_blank');
    }
};
