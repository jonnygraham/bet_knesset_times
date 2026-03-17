#!/bin/bash
API_KEY=$(aws ssm get-parameter --name /shul-agent/whatabot-api-key --with-decryption --query 'Parameter.Value' --output text --region us-east-1)
PHONE="%2B972543041655"
MSG=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''שלום וברכה לכל קהילת בית הכנסת!

*לשבת פרשת ויקרא, ג׳ בניסן (21.3.2026):*
• בכל חודש ניסן אין אומרים תחנון
• פרשת הנשיאים נשיא ליום
• הפטרה: ישעיהו מ״ג ״עם זו יצרתי״
• במנחה קוראים לשלושה בפרשת צו

*ברכות יום הולדת:*
מזל טוב לדביר גרשון ברגמן, אלעד הרשקו, חיים מסינגר, אלעד יושעי 🎂

*לשבת פרשת צו - שבת הגדול (28.3.2026):*
• מעבר לשעון קיץ ביום שישי ט׳ בניסן
• הפטרה: מלאכי ג׳ ״וערבה״
• קוראים הגדה מ״עבדים היינו״
• במוצ״ש אין אומרים ״ויהי נועם״

*יום הולדת:* יאיר גולדשמידט 🎂

שבת שלום ומבורך!'''))")

echo "Sending..."
curl -s "https://api.whatabot.net/whatsapp/sendMessage?apikey=${API_KEY}&text=${MSG}&phone=${PHONE}"
echo ""
