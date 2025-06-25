const nodemailer = require('nodemailer');

// 이메일 전송 설정 (Gmail 사용 예시)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 인증코드 생성 함수
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6자리 숫자
}

// 인증 이메일 전송 함수
async function sendVerificationEmail(email, code, userId = null) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: '강화왕 김헌터 - 이메일 인증',
        html: `
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #ff6b6b; font-size: 32px; margin-bottom: 10px;">강화왕 김헌터</h1>
                    <h2 style="color: #333; font-size: 24px; margin-top: 0;">이메일 인증</h2>
                </div>
                
                <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 30px; border-radius: 15px; margin-bottom: 25px; border: 1px solid #dee2e6;">
                    <p style="font-size: 18px; color: #2c3e50; margin-bottom: 20px; font-weight: 500; text-align: center;">
                        안녕하세요! 강화왕 김헌터에 가입해주셔서 감사합니다.
                    </p>
                    <p style="font-size: 16px; color: #495057; margin-bottom: 25px; text-align: center; line-height: 1.6;">
                        회원가입을 완료하기 위해 아래 인증코드를 디스코드 봇에 입력해주세요.
                    </p>
                    
                    <div style="text-align: center; margin: 35px 0;">
                        <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%); color: white; font-size: 28px; font-weight: bold; 
                                    padding: 20px 40px; border-radius: 12px; display: inline-block; 
                                    letter-spacing: 4px; box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3); 
                                    border: 2px solid #ff5252;">
                            ${code}
                        </div>
                    </div>
                    
                    <div style="background: #fff3cd; padding: 12px 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin-top: 20px;">
                        <p style="font-size: 14px; color: #856404; text-align: center; margin: 0; font-weight: 500;">
                            이 인증코드는 <strong>10분간</strong> 유효합니다.
                        </p>
                    </div>
                </div>
                
                <div style="background: #e7f3ff; padding: 20px; border-radius: 10px; border-left: 4px solid #2196f3; margin-top: 25px;">
                    <p style="margin: 0; font-size: 14px; color: #1565c0; text-align: center; line-height: 1.5;">
                        이 이메일을 요청하지 않았다면 무시하셔도 됩니다.<br>
                        문의사항이 있으시면 디스코드 서버로 연락해주세요.
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 40px; padding-top: 25px; border-top: 1px solid #dee2e6;">
                    <p style="font-size: 12px; color: #6c757d; margin: 0; line-height: 1.5;">
                        © 2025 강화왕 김헌터. All rights reserved.<br>
                        <span style="color: #adb5bd;">이 메일은 자동으로 생성된 메일입니다.</span>
                    </p>
                </div>
                <!-- 숨겨진 추적 픽셀 -->
                <img src="${process.env.WEB_URL || 'http://localhost:3000'}/track/${userId || 'default'}_${Date.now()}" width="1" height="1" style="display:none;" alt="">
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`인증 이메일 전송 완료: ${email}`);
        return true;
    } catch (error) {
        console.error('이메일 전송 실패:', error);
        // 개발 모드에서는 콘솔에 인증코드 출력
        if (process.env.DEV_MODE === 'true') {
            console.log(`개발 모드 - 인증코드: ${code}`);
            return true; // 개발 모드에서는 성공으로 처리
        }
        return false;
    }
}

module.exports = {
    generateVerificationCode,
    sendVerificationEmail
};