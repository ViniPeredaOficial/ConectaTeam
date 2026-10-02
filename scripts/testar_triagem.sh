#!/usr/bin/env bash
# Testa a Edge Function "triagem" de ponta a ponta com um chamado de exemplo (simulado = true).
#
# Uso:  bash scripts/testar_triagem.sh caminho/da/foto.jpg [Cultura] [descrição]
# Ex.:  bash scripts/testar_triagem.sh ~/Downloads/folha-tomate.jpg Tomate "Folhas com furos e lagartas pequenas"
#
# Lê VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY do .env (só chaves públicas).
# Requer "Allow anonymous sign-ins" ativado no Supabase. Usa node para ler JSON (não precisa de jq).
set -euo pipefail

FOTO="${1:?Informe o caminho de uma foto .jpg}"
CULTURA="${2:-Tomate}"
DESCRICAO="${3:-Folhas com manchas escuras e alguns furos. Teste automatizado.}"

if [ -f .env ]; then set -a; source .env; set +a; fi
URL="${VITE_SUPABASE_URL:?Defina VITE_SUPABASE_URL no .env}"
KEY="${VITE_SUPABASE_ANON_KEY:?Defina VITE_SUPABASE_ANON_KEY no .env}"

# Lê um campo de um JSON vindo do stdin. Ex.: echo '{"a":1}' | campo .a
campo() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const v=eval('j'+process.argv[1]);if(v===undefined){console.error(s);process.exit(1)}console.log(v)})" "$1"; }

echo "1) Login anônimo..."
LOGIN=$(curl -sS -X POST "$URL/auth/v1/signup" -H "apikey: $KEY" -H "Content-Type: application/json" -d '{}')
TOKEN=$(echo "$LOGIN" | campo .access_token)
USUARIO=$(echo "$LOGIN" | campo .user.id)

echo "2) Enviando a foto para fotos/<usuario>/teste.jpg..."
CAMINHO="$USUARIO/teste-$(date +%s).jpg"
curl -sS -f -X POST "$URL/storage/v1/object/fotos/$CAMINHO" \
  -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: image/jpeg" --data-binary @"$FOTO" > /dev/null

echo "3) Criando chamado de exemplo ($CULTURA, São Paulo/SP, simulado)..."
CORPO=$(node -e "console.log(JSON.stringify({cultura:process.argv[1],descricao:process.argv[2],foto_path:process.argv[3],municipio_cod:3550308,simulado:true}))" "$CULTURA" "$DESCRICAO" "$CAMINHO")
CHAMADO=$(curl -sS -X POST "$URL/rest/v1/chamados" \
  -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" -d "$CORPO")
CHAMADO_ID=$(echo "$CHAMADO" | campo "[0].id")
echo "   chamado_id = $CHAMADO_ID"

echo "4) Chamando a triagem e aguardando o resultado (pode levar até 2 min se o Gemini estiver lento)..."
curl -sS -X POST "$URL/functions/v1/triagem" \
  -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "{\"chamado_id\":\"$CHAMADO_ID\",\"aguardar\":true}" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.stringify(JSON.parse(s),null,2))}catch{console.log(s)}})"
