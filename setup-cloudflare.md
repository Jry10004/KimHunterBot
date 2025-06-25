# Cloudflare Tunnel 설정 가이드

## 1. Cloudflare Zero Trust 설정
1. https://one.dash.cloudflare.com/ 접속
2. 팀 이름 설정 (예: kimhunter)
3. 무료 플랜 선택

## 2. Tunnel 생성
1. Networks > Tunnels 메뉴로 이동
2. "Create a tunnel" 클릭
3. Tunnel 이름: kimhunter-tunnel
4. "Next" 클릭

## 3. Cloudflared 설치 (Windows)
1. https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe 다운로드
2. `C:\Users\USER\Desktop\Kimhunter` 폴더에 저장
3. 파일명을 `cloudflared.exe`로 변경

## 4. Tunnel 연결
Cloudflare 대시보드에서 제공하는 토큰으로:
```cmd
cloudflared.exe tunnel run --token <YOUR-TUNNEL-TOKEN>
```

## 5. Public Hostname 설정
1. Tunnels 페이지에서 생성한 tunnel 클릭
2. "Public Hostname" 탭
3. "Add a public hostname" 클릭
   - Subdomain: kimhunter-api
   - Domain: 자동 생성된 도메인 선택
   - Service: HTTP://localhost:3000

## 6. 완료!
이제 `https://kimhunter-api.팀이름.cloudflareaccess.com`으로 접속 가능