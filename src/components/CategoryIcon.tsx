// Ícones das categorias da home.
// Usa as imagens reais da loja (assets) para Sol, Grau, Grazi, MK e Infantil;
// Ray-Ban (sem imagem enviada) usa um ícone SVG wayfarer elegante.
import type { ReactElement } from "react";
import solImg from "../assets/categorias/sol.png";
import grauImg from "../assets/categorias/grau.png";
import graziImg from "../assets/categorias/grazi.png";
import mkImg from "../assets/categorias/mk.png";
import infantilImg from "../assets/categorias/infantil.png";

type IconProps = { className?: string };

const IMAGENS: Record<string, string> = {
  sol: solImg,
  grau: grauImg,
  grazi: graziImg,
  mk: mkImg,
  infantil: infantilImg,
};

function Wayfarer({ className }: IconProps): ReactElement {
  // Ray-Ban — ícone SVG (não veio imagem para esta categoria).
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 20h14l-1.5 7a3.5 3.5 0 0 1-3.4 2.7h-2.7A4.4 4.4 0 0 1 5 25.4z" />
      <path d="M29 20h14l-2.9 5.4A4.4 4.4 0 0 1 36.6 29.7h-2.7A3.5 3.5 0 0 1 30.5 27z" />
      <path d="M19 21h10" />
    </svg>
  );
}

export default function CategoryIcon({ name, className }: { name: string; className?: string }): ReactElement {
  const src = IMAGENS[name];
  if (src) {
    return <img src={src} alt="" className={className} loading="lazy" />;
  }
  return <Wayfarer className={className} />;
}
