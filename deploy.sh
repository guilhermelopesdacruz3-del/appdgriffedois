# Deploy das Edge Functions no Supabase (projeto unpbvztvscuisqnzofqp)
# Uso: abra o git-bash na pasta do projeto e rode:  bash deploy.sh
# (no Windows, use git-bash; ou converta para .bat)

set -e
PROJECT=unpbvztvscuisqnzofqp

echo "=> faca login (abre o browser, autorize)"
npx --yes supabase login

echo "=> link do projeto"
npx --yes supabase link --project-ref $PROJECT

echo "=> deploy li-proxy"
npx --yes supabase functions deploy li-proxy --project-ref $PROJECT

echo "=> deploy checkout-mp"
npx --yes supabase functions deploy checkout-mp --project-ref $PROJECT

echo "=> deploy config"
npx --yes supabase functions deploy config --project-ref $PROJECT

echo "=> lista functions"
npx --yes supabase functions list --project-ref $PROJECT

echo "PRONTO. Agora defina os Secrets no painel: Settings -> Edge Functions -> Secrets"
