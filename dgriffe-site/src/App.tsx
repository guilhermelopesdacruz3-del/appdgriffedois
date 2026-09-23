import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import ProductDetailPage from './pages/ProductDetailPage';
import MedicaoPage from './pages/MedicaoPage';
import HistoriaPage from './pages/HistoriaPage';
import AfiliadoPage from './pages/AfiliadoPage';
import AfiliadoAreaPage from './pages/AfiliadoAreaPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-ice">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/catalogo" element={<CatalogPage />} />
            <Route path="/produto/:id" element={<ProductDetailPage />} />
            <Route path="/medicao" element={<MedicaoPage />} />
            <Route path="/historia" element={<HistoriaPage />} />
            <Route path="/afiliado" element={<AfiliadoPage />} />
            <Route path="/afiliado-area" element={<AfiliadoAreaPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
