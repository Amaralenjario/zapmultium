import type { ReactElement } from "react";

// Ícone do app (gerado via next/og — sem PNG no repo). Fundo azul da marca (#3A5AF0)
// com o balãozinho de chat branco — o mesmo do menu lateral. Preenche as bordas (maskable).
export function appIcon(size: number): ReactElement {
  const s = Math.round(size * 0.56);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#3A5AF0" }}>
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      </svg>
    </div>
  );
}
