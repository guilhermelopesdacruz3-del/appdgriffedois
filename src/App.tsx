import { useState, useCallback, useEffect } from "react";
import { Product } from "./data";
import { useProdutos } from "./hooks/useProdutos";
import Header from "./components/layout/Header";
import BottomNav from "./components/layout/BottomNav";
import PurchaseDrawer from "./components/features/PurchaseDrawer";
import CartDrawer from "./components/features/CartDrawer";
import CheckoutDrawer from "./components/features/CheckoutDrawer";
import VirtualTryOn from "./components/features/VirtualTryOn";
import ScrollToTop from "./components/layout/ScrollToTop";
import HomePage from "./pages/HomePage";
import CatalogPage from "./pages/CatalogPage";
import ProductPage from "./pages/ProductPage";
import LoyaltyPage from "./pages/LoyaltyPage";
import ProfilePage from "./pages/ProfilePage";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import ClienteCadastro from "./pages/ClienteCadastro";
import AdminPage from "./pages/AdminPage";
import { ClienteProvider, useCliente } from "./hooks/useCliente";
import { useFidelidade } from "./hooks/useFidelidade";
import { useNotificacoes } from "./hooks/useNotificacoes";
import { ProductGridSkeleton } from "./components/features/ProductSkeleton";
import { useFavorites, useRecentlyViewed } from "./hooks/useUserLists";
import { useCidadeTema } from "./hooks/useCidadeTema";

interface CartItem {
  product: Product;
  colorIndex: number;
  quantity: number;
}

export default function App() {
  return <ClienteProvider><AppInner /></ClienteProvider>;
}

function AppInner() {
  const { cliente } = useCliente();
  const notif = useNotificacoes(cliente?.email);
  const fid = useFidelidade(cliente?.email);
  useCidadeTema();

  const [currentPage, setCurrentPage] = useState("home");
  const [previousPage, setPreviousPage] = useState("home");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [tryOnProduct, setTryOnProduct] = useState<Product | null>(null);
  const [tryOnOpen, setTryOnOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const raw = window.localStorage.getItem("dgriffe:carrinho");
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [showCartNotification, setShowCartNotification] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dark, setDark] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("dgriffe:theme") === "dark";
    } catch {
      return false;
    }
  });

  const toggleTheme = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      try { window.localStorage.setItem("dgriffe:theme", next ? "dark" : "light"); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const onPop = () => {
      setCheckoutOpen(false);
      setCartDrawerOpen(false);
      setTryOnOpen(false);
      setDrawerOpen(false);
      setSelectedProduct(null);
      setCurrentPage("home");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Cliente clicou no link de confirmação do e-mail (Supabase):
  //  - forma A: o Supabase redireciona com #access_token=...&refresh_token=...
  //    (fragmento) — salvamos a sessão direto;
  //  - forma B: ?token_hash=...&type=... (query string) — trocamos por sessão
  //    via /api/cliente/confirmar-link.
  useEffect(() => {
    try {
      const hash = window.location.hash;
      if (hash && hash.includes("access_token=")) {
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        if (accessToken) {
          try {
            window.localStorage.setItem("dgriffe:cliente_token", accessToken);
            if (refreshToken) window.localStorage.setItem("dgriffe:cliente_refresh_token", refreshToken);
          } catch { /* ignora */ }
          window.dispatchEvent(new Event("cliente-atualizado"));
          setCurrentPage("profile");
        }
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      if (tokenHash) {
        (async () => {
          try {
            const r = await fetch(`/api/cliente/confirmar-link`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token_hash: tokenHash, type: type || "magiclink" }),
            });
            const j = await r.json().catch(() => ({}));
            if (r.ok && j.session?.access_token) {
              const sess = j.session;
              try {
                window.localStorage.setItem("dgriffe:cliente_token", sess.access_token);
                if (sess.refresh_token) window.localStorage.setItem("dgriffe:cliente_refresh_token", sess.refresh_token);
              } catch { /* ignora */ }
              window.dispatchEvent(new Event("cliente-atualizado"));
              setCurrentPage("profile");
            }
          } catch { /* ignora — sem token, o app segue normal */ }
        })();
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch { /* ignora */ }
  }, []);

  const { isFavorite, toggleFavorite } = useFavorites();
  const { recentIds, registerView } = useRecentlyViewed();

  const [showAdmin, setShowAdmin] = useState(() => typeof window !== "undefined" && window.location.hash === "#/admin");
  useEffect(() => {
    const onHash = () => setShowAdmin(window.location.hash === "#/admin");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (showAdmin) {
    return <AdminPage onExit={() => { window.location.hash = ""; }} />;
  }

  const { produtos: products, loading: loadingProducts, error: productsError, reload: reloadProducts } = useProdutos({ limit: 100 });
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleSelectProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setPreviousPage(currentPage);
    setCurrentPage("product");
    registerView(product.id);
  }, [currentPage, registerView]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) setCurrentPage((prev) => (prev === "product" ? prev : "catalog"));
  }, []);

  const handleAddToCart = useCallback((product: Product) => {
    setDrawerProduct(product);
    setDrawerOpen(true);
  }, []);

  const handleConfirmAddToCart = useCallback((product: Product, colorIndex: number, quantity: number) => {
    setCartItems((prev) => {
      const existing = prev.findIndex((item) => item.product.id === product.id && item.colorIndex === colorIndex);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + quantity };
        return updated;
      }
      return [...prev, { product, colorIndex, quantity }];
    });
    setShowCartNotification(true);
    setTimeout(() => setShowCartNotification(false), 2000);
  }, []);

  const handleUpdateCartQuantity = useCallback((productId: number, colorIndex: number, delta: number) => {
    setCartItems((prev) => prev.map((item) => item.product.id === productId && item.colorIndex === colorIndex ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter((item) => item.quantity > 0));
  }, []);

  const handleRemoveCartItem = useCallback((productId: number, colorIndex: number) => {
    setCartItems((prev) => prev.filter((item) => !(item.product.id === productId && item.colorIndex === colorIndex)));
  }, []);

  const handleNavigate = useCallback((page: string) => {
    setCurrentPage(page);
    setSelectedProduct(null);
  }, []);

  const handleBackFromProduct = useCallback(() => {
    setSelectedProduct(null);
    setCurrentPage(previousPage);
  }, [previousPage]);

  const handleCartClick = useCallback(() => setCartDrawerOpen(true), []);
  const handleTryOn = useCallback((product: Product) => { setTryOnProduct(product); setTryOnOpen(true); }, []);
  const handleCloseTryOn = useCallback(() => { setTryOnOpen(false); setTimeout(() => setTryOnProduct(null), 300); }, []);

  useEffect(() => {
    try { window.localStorage.setItem("dgriffe:carrinho", JSON.stringify(cartItems)); } catch {}
  }, [cartItems]);

  const isProductPage = currentPage === "product";

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (dark) { root.classList.add("dark"); } else { root.classList.remove("dark"); }
      root.setAttribute("data-theme", dark ? "dark" : "light");
      root.style.setProperty("--bg-page", dark ? "#050505" : "");
    } catch {}
  }, [dark]);

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-ice relative">
      <Header
        cartCount={cartCount}
        onCartClick={handleCartClick}
        onBack={isProductPage ? handleBackFromProduct : undefined}
        title={isProductPage ? "" : undefined}
        dark={dark}
        onToggleTheme={toggleTheme}
        onSearch={handleSearch}
        notifNaoLidas={notif.naoLidas}
        onNotifClick={() => notif.setAberto(true)}
      />

      <main className="pt-14 pb-16">
        {productsError && (
          <div className="mx-4 mt-3 bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
            <p className="text-xs font-semibold text-red-600">Não foi possível carregar os produtos da loja.</p>
            <p className="text-[10px] text-red-400 mt-1">{productsError}</p>
            <button onClick={reloadProducts} className="mt-3 text-[10px] font-bold text-red-600 underline">Tentar novamente</button>
          </div>
        )}
        {loadingProducts && products.length === 0 && !productsError && (currentPage === "home" || currentPage === "catalog") && (
          <div className="pt-4"><ProductGridSkeleton count={6} /></div>
        )}
        {currentPage === "home" && !(loadingProducts && products.length === 0) && (
          <HomePage products={products} onSelectProduct={handleSelectProduct} onAddToCart={handleAddToCart} onNavigate={handleNavigate} onTryOn={handleTryOn} recentIds={recentIds} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />
        )}
        {currentPage === "catalog" && !(loadingProducts && products.length === 0) && (
          <CatalogPage products={products} onSelectProduct={handleSelectProduct} onAddToCart={handleAddToCart} onTryOn={handleTryOn} searchQuery={searchQuery} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />
        )}
        {currentPage === "product" && selectedProduct && (
          <ProductPage product={selectedProduct} onBack={handleBackFromProduct} onTryOn={handleTryOn} />
        )}
        {currentPage === "loyalty" && <LoyaltyPage fidelidade={fid.info} historicoFidelidade={fid.historico} fidelidadeLoading={fid.loading} />}
        {currentPage === "profile" && (
          <ErrorBoundary>
            <ProfilePage onNavigate={handleNavigate} fidelidade={fid.info} />
          </ErrorBoundary>
        )}
        {currentPage === "cadastro" && <ClienteCadastro onVoltar={() => setCurrentPage("profile")} />}
      </main>

      {!isProductPage && <BottomNav activePage={currentPage} onNavigate={handleNavigate} dark={dark} />}

      <ScrollToTop />

      <PurchaseDrawer product={drawerProduct} isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} onConfirm={handleConfirmAddToCart} />

      <CartDrawer items={cartItems} isOpen={cartDrawerOpen} onClose={() => setCartDrawerOpen(false)} onUpdateQuantity={handleUpdateCartQuantity} onRemove={handleRemoveCartItem} onCheckout={() => { setCartDrawerOpen(false); setCheckoutOpen(true); }} />

      <CheckoutDrawer items={cartItems} isOpen={checkoutOpen} onClose={() => setCheckoutOpen(false)} fidelidade={fid.info} />

      {tryOnProduct && <VirtualTryOn isOpen={tryOnOpen} onClose={handleCloseTryOn} product={tryOnProduct} onAddToCart={handleAddToCart} />}

      {notif.aberto && (
        <div className="fixed top-16 right-4 left-4 z-[80] max-w-lg mx-auto animate-slide-down">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-bold text-luxury-black">Notificações</p>
              <button onClick={() => notif.setAberto(false)} className="text-gray-400 text-xs">Fechar</button>
            </div>
            {notif.notificacoes.length === 0 ? <p className="text-xs text-gray-400 text-center py-8">Nenhuma notificação ainda.</p> : notif.notificacoes.map((n) => (
              <button key={n.id} onClick={() => notif.marcarLida(n.id)} className="w-full text-left px-4 py-3 border-b border-gray-50 flex gap-3 active:bg-ice">
                <div className="flex-1">
                  <p className="text-xs font-bold text-luxury-black">{n.titulo}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{n.corpo}</p>
                  <p className="text-[9px] text-gray-300 mt-1 uppercase">{n.tipo}</p>
                </div>
                {!n.lida && <span className="w-2 h-2 rounded-full bg-gold mt-1 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {showCartNotification && (
        <div className="fixed top-16 left-4 right-4 z-[80] max-w-lg mx-auto animate-slide-down">
          <div className="bg-luxury-black text-white rounded-2xl p-4 flex items-center gap-3 shadow-xl">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold">Adicionado ao carrinho!</p>
              <p className="text-[10px] text-gray-400">
                {cartCount} {cartCount === 1 ? "item" : "itens"} •{" "}
                {cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
            <button onClick={() => { setShowCartNotification(false); setCartDrawerOpen(true); }} className="text-gold text-[10px] font-bold hover:text-gold-light">Ver</button>
          </div>
        </div>
      )}
    </div>
  );
}
