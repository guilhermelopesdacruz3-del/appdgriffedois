import { useState, useCallback, useEffect } from "react";
import { Product } from "./data";
import { useProdutos } from "./hooks/useProdutos";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import PurchaseDrawer from "./components/PurchaseDrawer";
import CartDrawer from "./components/CartDrawer";
import CheckoutDrawer from "./components/CheckoutDrawer";
import VirtualTryOn from "./components/VirtualTryOn";
import ScrollToTop from "./components/ScrollToTop";
import HomePage from "./pages/HomePage";
import CatalogPage from "./pages/CatalogPage";
import ProductPage from "./pages/ProductPage";
import LoyaltyPage from "./pages/LoyaltyPage";
import ProfilePage from "./pages/ProfilePage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import ClienteCadastro from "./pages/ClienteCadastro";
import AdminPage from "./pages/AdminPage";
import { ProductGridSkeleton } from "./components/ProductSkeleton";
import { useFavorites, useRecentlyViewed } from "./hooks/useUserLists";


interface CartItem {
  product: Product;
  colorIndex: number;
  quantity: number;
}

export default function App() {
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

  const { isFavorite, toggleFavorite } = useFavorites();
  const { recentIds, registerView } = useRecentlyViewed();

  // Rota de administrador (/admin) — acessada via URL com hash (#/admin).
  const [showAdmin, setShowAdmin] = useState(
    () => typeof window !== "undefined" && window.location.hash === "#/admin"
  );
  useEffect(() => {
    const onHash = () => setShowAdmin(window.location.hash === "#/admin");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (showAdmin) {
    return (
      <AdminPage
        onExit={() => {
          window.location.hash = "";
        }}
      />
    );
  }

  // Produtos vindos em tempo real da Loja Integrada (veja src/services/lojaIntegrada).
  // limit alto cobre o catálogo inteiro da ótica; as imagens usam loading="lazy"
  // (ProductCard) então só as visíveis carregam — sem peso no 1º render.
  const { produtos: products, loading: loadingProducts, error: productsError, reload: reloadProducts } = useProdutos({ limit: 120 });

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleSelectProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setPreviousPage(currentPage);
    setCurrentPage("product");
    registerView(product.id);
  }, [currentPage, registerView]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setCurrentPage((prev) => (prev === "product" ? prev : "catalog"));
    }
  }, []);

  const handleAddToCart = useCallback((product: Product) => {
    setDrawerProduct(product);
    setDrawerOpen(true);
  }, []);

  const handleConfirmAddToCart = useCallback(
    (product: Product, colorIndex: number, quantity: number) => {
      setCartItems((prev) => {
        const existing = prev.findIndex(
          (item) => item.product.id === product.id && item.colorIndex === colorIndex
        );
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = {
            ...updated[existing],
            quantity: updated[existing].quantity + quantity,
          };
          return updated;
        }
        return [...prev, { product, colorIndex, quantity }];
      });
      setShowCartNotification(true);
      setTimeout(() => setShowCartNotification(false), 2000);
    },
    []
  );

  const handleUpdateCartQuantity = useCallback(
    (productId: number, colorIndex: number, delta: number) => {
      setCartItems((prev) => {
        return prev
          .map((item) => {
            if (item.product.id === productId && item.colorIndex === colorIndex) {
              const newQty = item.quantity + delta;
              if (newQty <= 0) return null;
              return { ...item, quantity: newQty };
            }
            return item;
          })
          .filter(Boolean) as CartItem[];
      });
    },
    []
  );

  const handleRemoveCartItem = useCallback((productId: number, colorIndex: number) => {
    setCartItems((prev) =>
      prev.filter((item) => !(item.product.id === productId && item.colorIndex === colorIndex))
    );
  }, []);

  const handleNavigate = useCallback((page: string) => {
    setCurrentPage(page);
    setSelectedProduct(null);
  }, []);

  const handleBackFromProduct = useCallback(() => {
    setSelectedProduct(null);
    setCurrentPage(previousPage);
  }, [previousPage]);

  const handleCartClick = useCallback(() => {
    setCartDrawerOpen(true);
  }, []);

  const handleTryOn = useCallback((product: Product) => {
    setTryOnProduct(product);
    setTryOnOpen(true);
  }, []);

  const handleCloseTryOn = useCallback(() => {
    setTryOnOpen(false);
    setTimeout(() => setTryOnProduct(null), 300);
  }, []);

  // Persiste o carrinho no localStorage (sobrevive a recarregamentos).
  useEffect(() => {
    try {
      window.localStorage.setItem("dgriffe:carrinho", JSON.stringify(cartItems));
    } catch {
      /* ignora quota/privado */
    }
  }, [cartItems]);

  const isProductPage = currentPage === "product";

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-ice relative">
      {/* Header */}
      <Header
        cartCount={cartCount}
        onCartClick={handleCartClick}
        onBack={isProductPage ? handleBackFromProduct : undefined}
        title={isProductPage ? "" : undefined}
        dark={false}
        onSearch={handleSearch}
      />

      {/* Page Content */}
      <main className="pt-14 pb-16">
        {productsError && (
          <div className="mx-4 mt-3 bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
            <p className="text-xs font-semibold text-red-600">Não foi possível carregar os produtos da loja.</p>
            <p className="text-[10px] text-red-400 mt-1">{productsError}</p>
            <button
              onClick={reloadProducts}
              className="mt-3 text-[10px] font-bold text-red-600 underline"
            >
              Tentar novamente
            </button>
          </div>
        )}
        {loadingProducts && products.length === 0 && !productsError && (currentPage === "home" || currentPage === "catalog") && (
          <div className="pt-4">
            <ProductGridSkeleton count={6} />
          </div>
        )}
        {currentPage === "home" && !(loadingProducts && products.length === 0) && (
          <HomePage
            products={products}
            onSelectProduct={handleSelectProduct}
            onAddToCart={handleAddToCart}
            onNavigate={handleNavigate}
            onTryOn={handleTryOn}
            recentIds={recentIds}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
          />
        )}
        {currentPage === "catalog" && !(loadingProducts && products.length === 0) && (
          <CatalogPage
            products={products}
            onSelectProduct={handleSelectProduct}
            onAddToCart={handleAddToCart}
            onTryOn={handleTryOn}
            searchQuery={searchQuery}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
          />
        )}
        {currentPage === "product" && selectedProduct && (
          <ProductPage
            product={selectedProduct}
            onBack={handleBackFromProduct}
            onAddToCart={handleAddToCart}
            onTryOn={handleTryOn}
          />
        )}
        {currentPage === "loyalty" && <LoyaltyPage />}
        {currentPage === "profile" && (
          <ErrorBoundary>
            <ProfilePage onNavigate={handleNavigate} />
          </ErrorBoundary>
        )}
        {currentPage === "cadastro" && <ClienteCadastro onVoltar={() => setCurrentPage("profile")} />}
      </main>

      {/* Bottom Navigation */}
      {!isProductPage && (
        <BottomNav activePage={currentPage} onNavigate={handleNavigate} />
      )}

      {/* Scroll to Top */}
      <ScrollToTop />

      {/* Purchase Drawer */}
      <PurchaseDrawer
        product={drawerProduct}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onConfirm={handleConfirmAddToCart}
      />

      {/* Cart Drawer */}
      <CartDrawer
        items={cartItems}
        isOpen={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemove={handleRemoveCartItem}
        onCheckout={() => {
          setCartDrawerOpen(false);
          setCheckoutOpen(true);
        }}
      />

      {/* Checkout (PIX / cartão dentro do app) */}
      <CheckoutDrawer
        items={cartItems}
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
      />

      {/* Virtual Try-On */}
      {tryOnProduct && (
        <VirtualTryOn
          isOpen={tryOnOpen}
          onClose={handleCloseTryOn}
          product={tryOnProduct}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Cart Notification */}
      {showCartNotification && (
        <div className="fixed top-16 left-4 right-4 z-[80] max-w-lg mx-auto animate-slide-down">
          <div className="bg-luxury-black text-white rounded-2xl p-4 flex items-center gap-3 shadow-xl">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold">Adicionado ao carrinho!</p>
              <p className="text-[10px] text-gray-400">
                {cartCount} {cartCount === 1 ? "item" : "itens"} •{" "}
                {cartItems
                  .reduce((sum, item) => sum + item.product.price * item.quantity, 0)
                  .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
            <button
              onClick={() => {
                setShowCartNotification(false);
                setCartDrawerOpen(true);
              }}
              className="text-gold text-[10px] font-bold hover:text-gold-light"
            >
              Ver
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
