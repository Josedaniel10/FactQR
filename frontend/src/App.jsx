import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState } from 'react'
import logoImage from './assets/logo.jpeg'
import americanoImage from './assets/cafe-americano.png'
import sandwichImage from './assets/sandwich.png'
import juiceImage from './assets/jugo-natural.png'
import cakeImage from './assets/trozo-pastel.png'
import heroImage from './assets/hero.png'
import { supabase } from './supabaseClient'

const initialProducts = [
  { id: 'coffee', name: 'Americano', price: 10000, category: 'Bebidas', accent: '#c99b73', description: 'Cafe de preparacion directa, tostado medio y final limpio.', badge: 'Popular', image: americanoImage },
  { id: 'sandwich', name: 'Sandwich artesanal', price: 12000, category: 'Comidas', accent: '#d9a441', description: 'Sandwich preparado al momento con ingredientes frescos.', badge: 'Nuevo', image: sandwichImage },
  { id: 'juice', name: 'Jugo natural', price: 10000, category: 'Bebidas', accent: '#ef8b5b', description: 'Jugo natural de fruta seleccionada y servido bien frio.', badge: '', image: juiceImage },
  { id: 'cake', name: 'Porcion de torta', price: 12000, category: 'Postres', accent: '#b78368', description: 'Porcion generosa con textura suave y sabor casero.', badge: 'Favorito', image: cakeImage },
]

const categories = ['Todos', 'Bebidas', 'Comidas', 'Postres']
const formatCurrency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const createPaymentUrl = 'https://pvbpqowxjpqjkjwglkes.supabase.co/functions/v1/create-payment'
const paymentStatusUrl = 'https://pvbpqowxjpqjkjwglkes.supabase.co/functions/v1/payment-status'
const simulatePaymentUrl = 'https://pvbpqowxjpqjkjwglkes.supabase.co/functions/v1/simulate-payment'
const issueInvoiceUrl = 'https://pvbpqowxjpqjkjwglkes.supabase.co/functions/v1/issue-invoice'
const sendInvoiceEmailUrl = 'https://pvbpqowxjpqjkjwglkes.supabase.co/functions/v1/send-invoice-email'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function Icon({ name, size = 20 }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    cart: <><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /><path d="M3 4h2l2.4 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    close: <><path d="M6 6l12 12M18 6 6 18" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [showAuth, setShowAuth] = useState(false)
  const [sales, setSales] = useState([])
  const [isLoadingSales, setIsLoadingSales] = useState(false)
  const [products, setProducts] = useState(() => {
    try {
      const storedProducts = JSON.parse(localStorage.getItem('factqr-products'))
      if (!Array.isArray(storedProducts)) return initialProducts

      return storedProducts.map((product) => {
        const currentProduct = initialProducts.find((item) => item.id === product.id)
        return currentProduct ? { ...product, image: currentProduct.image } : product
      })
    } catch {
      return initialProducts
    }
  })
  const [cart, setCart] = useState({})
  const [page, setPage] = useState('home')
  const [category, setCategory] = useState('Todos')
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('FACTUS_PAY')
  const [payment, setPayment] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [error, setError] = useState('')
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false)
  const [isIssuingInvoice, setIsIssuingInvoice] = useState(false)
  const [invoiceEmail, setInvoiceEmail] = useState('')
  const [isSendingInvoiceEmail, setIsSendingInvoiceEmail] = useState(false)
  const [invoiceEmailSent, setInvoiceEmailSent] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      return
    }

    supabase
      .from('profiles')
      .select('id,email,full_name,role')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data))
  }, [session?.user?.id])

  const loadSales = async () => {
    if (!session?.user) {
      setShowAuth(true)
      return
    }
    setIsLoadingSales(true)
    const { data, error: salesError } = await supabase
      .from('orders')
      .select('id,status,total,created_at,order_items(name,quantity,unit_price),payments(status,reference_code,amount,collected_at),invoices(number,is_validated,public_url)')
      .order('created_at', { ascending: false })
      .limit(50)
    if (salesError) setError(salesError.message)
    setSales(data || [])
    setIsLoadingSales(false)
  }

  const handleAuth = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email')).trim()
    const password = String(form.get('password'))
    const fullName = String(form.get('fullName') || '').trim()
    setError('')

    const result = authMode === 'register'
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
      : await supabase.auth.signInWithPassword({ email, password })

    if (result.error) {
      setError(result.error.message)
      return
    }
    if (authMode === 'register' && !result.data.session) {
      setError('Revisa tu correo para confirmar la cuenta.')
      return
    }
    setShowAuth(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSales([])
    setPage('home')
  }

  useEffect(() => {
    const productsToStore = products.map((product) => {
      const defaultProduct = initialProducts.find((item) => item.id === product.id)
      if (!defaultProduct) return product
      const { image, ...productWithoutImage } = product
      return productWithoutImage
    })
    localStorage.setItem('factqr-products', JSON.stringify(productsToStore))
  }, [products])

  useEffect(() => {
    if (!payment?.referenceCode || payment.status !== 'READY') return undefined
    const pollPayment = async () => {
      try {
        const response = await fetch(`${paymentStatusUrl}?reference=${encodeURIComponent(payment.referenceCode)}`)
        const result = await response.json()
        if (response.ok && result.data?.status === 'PAID') setPayment((current) => ({ ...current, status: 'PAID' }))
      } catch {
        // Preserve the latest UI state while the connection recovers.
      }
    }
    const intervalId = window.setInterval(pollPayment, 3000)
    return () => window.clearInterval(intervalId)
  }, [payment?.referenceCode, payment?.status])

  const cartItems = useMemo(() => products.filter((product) => cart[product.id]).map((product) => ({ ...product, quantity: cart[product.id] })), [products, cart])
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const filteredProducts = products.filter((product) => (category === 'Todos' || product.category === category) && product.name.toLowerCase().includes(search.toLowerCase()))

  const navigate = (nextPage) => {
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const addProduct = (productId) => setCart((current) => ({ ...current, [productId]: (current[productId] || 0) + 1 }))
  const changeQuantity = (productId, change) => setCart((current) => {
    const quantity = (current[productId] || 0) + change
    if (quantity <= 0) {
      const { [productId]: removed, ...remaining } = current
      return remaining
    }
    return { ...current, [productId]: quantity }
  })

  const handleCreatePayment = async () => {
    if (!session) {
      setShowAuth(true)
      return
    }
    setError('')
    setIsCreatingPayment(true)
    setPayment(null)
    setInvoice(null)
    try {
      const response = await fetch(createPaymentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ mode: 'A', paymentMethod, items: cartItems.map((item) => ({ code: item.id, name: item.name, price: item.price, quantity: item.quantity })) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error?.message || 'No se pudo crear el cobro.')
      setPayment(result.data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo crear el cobro.')
    } finally {
      setIsCreatingPayment(false)
    }
  }

  const handleSimulatePayment = async () => {
    if (!payment) return
    setError('')
    setIsSimulatingPayment(true)
    try {
      const response = await fetch(simulatePaymentUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference: payment.referenceCode }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error?.message || 'No se pudo simular el pago.')
      setPayment((current) => ({ ...current, status: 'PAID' }))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo simular el pago.')
    } finally {
      setIsSimulatingPayment(false)
    }
  }

  const handleIssueInvoice = async () => {
    if (!payment) return
    setError('')
    setIsIssuingInvoice(true)
    try {
      const response = await fetch(issueInvoiceUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference: payment.referenceCode }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error?.message || 'No se pudo emitir la factura.')
      setInvoice(result.data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo emitir la factura.')
    } finally {
      setIsIssuingInvoice(false)
    }
  }

  const handleSendInvoiceEmail = async (event) => {
    event.preventDefault()
    if (!payment || !invoice) return
    setError('')
    setInvoiceEmailSent(false)
    setIsSendingInvoiceEmail(true)
    try {
      const response = await fetch(sendInvoiceEmailUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ reference: payment.referenceCode, email: invoiceEmail }),
      })
      const result = await response.json()
      if (!response.ok) {
        const factusErrors = result.error?.details?.data?.errors
        const validationMessage = factusErrors && typeof factusErrors === 'object'
          ? Object.values(factusErrors).flat().join(' ')
          : result.error?.details?.message || result.error?.details?.data?.message
        throw new Error(validationMessage || result.error?.message || 'No se pudo enviar la factura.')
      }
      setInvoiceEmailSent(true)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo enviar la factura.')
    } finally {
      setIsSendingInvoiceEmail(false)
    }
  }

  const handleAddProduct = (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name')).trim()
    const price = Number(data.get('price'))
    const categoryName = String(data.get('category'))
    if (!name || price < 10000) {
      setError('El producto necesita un nombre y un precio minimo de $10.000 COP.')
      return
    }
    const product = {
      id: crypto.randomUUID(),
      name,
      price,
      category: categoryName,
      accent: String(data.get('color') || '#c99b73'),
      description: String(data.get('description')).trim() || 'Producto disponible en FactQR.',
      badge: 'Nuevo',
    }
    setProducts((current) => [...current, product])
    setShowAddProduct(false)
    setError('')
  }

  const openProduct = (product) => {
    setSelectedProduct(product)
    setPage('detail')
    window.scrollTo({ top: 0 })
  }

  const Header = () => (
    <>
      <div className="announcement">Sandbox seguro · Factus Pay integrado · Facturas demo disponibles</div>
      <header className="site-header">
        <button className="brand" type="button" onClick={() => navigate('home')} aria-label="Ir al inicio">
          <img className="brand-logo" src={logoImage} alt="" /><span>FactQR</span>
        </button>
        <nav aria-label="Navegacion principal">
          <button className={page === 'home' ? 'active' : ''} type="button" onClick={() => navigate('home')}>Inicio</button>
          <button className={page === 'catalog' ? 'active' : ''} type="button" onClick={() => navigate('catalog')}>Catalogo</button>
          <button type="button" onClick={() => { navigate('catalog'); setCategory('Bebidas') }}>Bebidas</button>
          <button type="button" onClick={() => { navigate('catalog'); setCategory('Comidas') }}>Comidas</button>
          {session && <button className={page === 'sales' ? 'active' : ''} type="button" onClick={() => { navigate('sales'); loadSales() }}>Mis compras</button>}
        </nav>
        <div className="header-actions">
          <label className="search-box"><Icon name="search" /><input value={search} onChange={(event) => { setSearch(event.target.value); if (page === 'home') navigate('catalog') }} placeholder="Buscar" aria-label="Buscar productos" /></label>
          <button className="icon-button" type="button" aria-label={session ? 'Cerrar sesion' : 'Iniciar sesion'} onClick={() => session ? handleLogout() : setShowAuth(true)}><Icon name="user" /></button>
          <button className="cart-button" type="button" onClick={() => navigate('cart')}><Icon name="cart" /><span>Carrito</span><b>{itemCount}</b></button>
        </div>
      </header>
    </>
  )

  const ProductVisual = ({ product, large = false }) => (
    <div className={`product-visual ${large ? 'large' : ''}`} style={{ '--accent': product.accent }}>
      {product.image ? (
        <img className="product-photo" src={product.image} alt={product.name} />
      ) : (
        <>
          <span className="visual-orbit" /><span className="visual-product">{product.name.slice(0, 1)}</span>
          <span className="visual-shadow" />
        </>
      )}
    </div>
  )

  const ProductCard = ({ product }) => (
    <article className="product-card">
      <button className="product-image-button" type="button" onClick={() => openProduct(product)}>
        {product.badge && <span className="product-badge">{product.badge}</span>}
        <ProductVisual product={product} />
      </button>
      <div className="product-card-body">
        <span>{product.category}</span>
        <button type="button" onClick={() => openProduct(product)}><h3>{product.name}</h3></button>
        <strong>{formatCurrency.format(product.price)}</strong>
        <button className="add-button" type="button" onClick={() => addProduct(product.id)} aria-label={`Agregar ${product.name}`}><Icon name="plus" /> Agregar</button>
      </div>
    </article>
  )

  const Footer = () => (
    <footer>
      <div className="footer-brand"><img className="brand-logo" src={logoImage} alt="" /><div><strong>FactQR</strong><p>Cobros simples, ventas claras y facturacion integrada.</p></div></div>
      <div><strong>Explorar</strong><button type="button" onClick={() => navigate('home')}>Inicio</button><button type="button" onClick={() => navigate('catalog')}>Catalogo</button></div>
      <div><strong>FactQR</strong><button type="button" onClick={() => setShowAddProduct(true)}>Agregar producto</button><button type="button">Soporte</button></div>
      <div><strong>Estado</strong><span className="footer-status"><i />SandBox operativo</span><small>Ambiente de demostracion</small></div>
    </footer>
  )

  return (
    <div className="app-shell">
      <Header />
      {page === 'home' && (
        <main>
          <section className="hero">
            <div className="hero-copy">
              <span className="hero-kicker">La nueva forma de cobrar</span>
              <h1>Todo tu punto de venta, <em>en un solo lugar.</em></h1>
              <p>Organiza productos, crea pedidos y recibe pagos con QR desde una experiencia rapida y profesional.</p>
              <div className="hero-actions"><button className="primary-button" type="button" onClick={() => navigate('catalog')}>Explorar productos <Icon name="arrow" /></button><button className="text-button" type="button" onClick={() => setShowAddProduct(true)}>Agregar un producto</button></div>
            </div>
            <div className="hero-art"><img className="hero-image" src={heroImage} alt="Venta FactQR con pago mediante codigo QR" /><div className="hero-card"><span>Venta lista</span><strong>$32.000</strong><small><Icon name="check" /> Pago confirmado</small></div></div>
          </section>

          <section className="feature-strip">
            {[['01', 'Catalogo', 'Organiza tu oferta'], ['02', 'Pago QR', 'Factus Pay sandbox'], ['03', 'Facturacion', 'Documentos de prueba']].map(([number, title, text]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}
          </section>

          <section className="home-section">
            <div className="section-heading"><div><span>Nuestra seleccion</span><h2>Productos destacados</h2></div><button className="text-button" type="button" onClick={() => navigate('catalog')}>Ver todo <Icon name="arrow" /></button></div>
            <div className="featured-grid">{products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}</div>
          </section>

          <section className="promo-banner">
            <div><span>Factus Pay</span><h2>Cobra sin fricciones</h2><p>Genera un QR unico para cada venta y consulta el estado del pago en tiempo real.</p><button className="dark-button" type="button" onClick={() => navigate('catalog')}>Crear una venta</button></div>
            <div className="promo-qr"><QRCodeSVG value="FACTQR-DEMO" size={150} /></div>
          </section>
        </main>
      )}

      {page === 'catalog' && (
        <main className="catalog-page">
          <div className="page-heading"><span>Catalogo FactQR</span><h1>Encuentra lo que necesitas</h1><p>Selecciona productos, agrega cantidades y continua al pago.</p></div>
          <div className="catalog-layout">
            <aside className="filters">
              <div className="filter-heading"><strong>Filtros</strong><button type="button" onClick={() => { setCategory('Todos'); setSearch('') }}>Limpiar</button></div>
              <h3>Categoria</h3>
              {categories.map((item) => <label key={item}><input type="radio" checked={category === item} onChange={() => setCategory(item)} /><span>{item}</span><small>{item === 'Todos' ? products.length : products.filter((product) => product.category === item).length}</small></label>)}
              <button className="outline-button" type="button" onClick={() => setShowAddProduct(true)}><Icon name="plus" /> Nuevo producto</button>
            </aside>
            <section>
              <div className="catalog-toolbar"><span>{filteredProducts.length} productos</span><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Categoria rapida">{categories.map((item) => <option key={item}>{item}</option>)}</select></div>
              {filteredProducts.length ? <div className="catalog-grid">{filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-state"><h2>No encontramos productos</h2><p>Prueba otra categoria o agrega uno nuevo.</p></div>}
            </section>
          </div>
        </main>
      )}

      {page === 'detail' && selectedProduct && (
        <main className="detail-page">
          <button className="back-button" type="button" onClick={() => navigate('catalog')}>← Volver al catalogo</button>
          <section className="product-detail">
            <ProductVisual product={selectedProduct} large />
            <div className="detail-copy"><span>{selectedProduct.category}</span><h1>{selectedProduct.name}</h1><strong>{formatCurrency.format(selectedProduct.price)}</strong><p>{selectedProduct.description}</p><ul><li><Icon name="check" /> Disponible para pago inmediato</li><li><Icon name="check" /> Compatible con QR y efectivo</li><li><Icon name="check" /> Factura de demostracion</li></ul><button className="primary-button" type="button" onClick={() => { addProduct(selectedProduct.id); navigate('cart') }}><Icon name="cart" /> Agregar al carrito</button></div>
          </section>
        </main>
      )}

      {page === 'cart' && (
        <main className="cart-page">
          <div className="page-heading cart-heading"><span>Tu pedido</span><h1>Carrito de compra</h1></div>
          {!cartItems.length ? (
            <div className="empty-cart"><span>0</span><h2>Tu carrito esta vacio</h2><p>Elige productos del catalogo para comenzar una venta.</p><button className="primary-button" type="button" onClick={() => navigate('catalog')}>Explorar catalogo</button></div>
          ) : (
            <div className="cart-layout">
              <section className="cart-list">
                <div className="cart-list-heading"><strong>Producto</strong><strong>Subtotal</strong></div>
                {cartItems.map((item) => (
                  <article className="cart-row" key={item.id}><ProductVisual product={item} /><div><span>{item.category}</span><h2>{item.name}</h2><strong>{formatCurrency.format(item.price)}</strong></div><div className="quantity-control"><button type="button" onClick={() => changeQuantity(item.id, -1)}>−</button><span>{item.quantity}</span><button type="button" onClick={() => changeQuantity(item.id, 1)}>+</button></div><strong>{formatCurrency.format(item.price * item.quantity)}</strong></article>
                ))}
              </section>
              <aside className="checkout-card">
                <h2>Resumen</h2>
                <div><span>Subtotal</span><strong>{formatCurrency.format(subtotal)}</strong></div>
                <div><span>Entrega</span><strong>Incluida</strong></div>
                <div className="checkout-total"><span>Total</span><strong>{formatCurrency.format(subtotal)}</strong></div>
                <fieldset className="payment-methods"><legend>Metodo de pago</legend>{[['FACTUS_PAY', 'Factus Pay', 'Paga con QR'], ['CASH', 'Efectivo', 'Pago confirmado'], ['SIMULATION', 'Simulado', 'Para pruebas']].map(([value, title, description]) => <label className={paymentMethod === value ? 'selected' : ''} key={value}><input type="radio" name="paymentMethod" checked={paymentMethod === value} onChange={() => setPaymentMethod(value)} /><span><strong>{title}</strong><small>{description}</small></span></label>)}</fieldset>
                {!payment && <button className="primary-button" type="button" disabled={isCreatingPayment} onClick={handleCreatePayment}>{isCreatingPayment ? 'Generando cobro...' : 'Confirmar y pagar'}</button>}
                {payment?.provider === 'FACTUS_PAY' && payment.status === 'READY' && <div className="checkout-payment"><h3>Escanea tu QR</h3>{payment.qr?.startsWith('data:image/') ? <img src={payment.qr} alt="QR Factus Pay" /> : <QRCodeSVG value={payment.qr || payment.referenceCode} size={180} />}<small>{payment.referenceCode}</small><button className="secondary-button" type="button" disabled={isSimulatingPayment} onClick={handleSimulatePayment}>{isSimulatingPayment ? 'Confirmando...' : 'Simular pago aprobado'}</button></div>}
                {payment?.status === 'PAID' && <div className="paid-state"><span><Icon name="check" /></span><div><strong>Pago confirmado</strong><small>{payment.provider === 'CASH' ? 'Efectivo recibido' : payment.referenceCode}</small></div></div>}
                {payment?.status === 'PAID' && !invoice && <button className="secondary-button" type="button" disabled={isIssuingInvoice} onClick={handleIssueInvoice}>{isIssuingInvoice ? 'Facturando...' : 'Emitir factura demo'}</button>}
                {invoice && (
                  <div className="invoice-state">
                    <strong>Factura {invoice.number}</strong>
                    {invoice.publicUrl && <a href={invoice.publicUrl} target="_blank" rel="noreferrer">Ver documento</a>}
                    <form className="invoice-email-form" onSubmit={handleSendInvoiceEmail}>
                      <label htmlFor="invoice-email">Enviar por correo</label>
                      <div>
                        <input
                          id="invoice-email"
                          type="email"
                          required
                          value={invoiceEmail}
                          onChange={(event) => setInvoiceEmail(event.target.value)}
                          placeholder="correo@ejemplo.com"
                        />
                        <button className="secondary-button" type="submit" disabled={isSendingInvoiceEmail}>
                          {isSendingInvoiceEmail ? 'Enviando...' : 'Enviar'}
                        </button>
                      </div>
                      <small>Sandbox: utiliza un correo previamente autorizado en tu cuenta Factus.</small>
                      {invoiceEmailSent && <small className="invoice-email-success" role="status">Factura enviada correctamente.</small>}
                    </form>
                  </div>
                )}
                {error && <p className="form-error" role="alert">{error}</p>}
              </aside>
            </div>
          )}
        </main>
      )}

      {page === 'sales' && (
        <main className="sales-page">
          <div className="page-heading"><span>{profile?.full_name || session?.user?.email}</span><h1>Mis compras</h1><p>Consulta tus pedidos, pagos y facturas.</p></div>
          {isLoadingSales ? <div className="empty-state"><h2>Cargando compras...</h2></div> : sales.length === 0 ? (
            <div className="empty-state"><h2>No tienes compras registradas</h2><p>Tus pedidos apareceran aqui despues del pago.</p></div>
          ) : (
            <section className="sales-list">
              {sales.map((sale) => {
                const payment = sale.payments?.[0]
                const invoice = sale.invoices?.[0]
                return (
                  <article className="sale-card" key={sale.id}>
                    <div className="sale-card-heading">
                      <div><span>{new Date(sale.created_at).toLocaleString('es-CO')}</span><strong>{sale.id.slice(0, 8).toUpperCase()}</strong></div>
                      <b>{sale.status}</b>
                    </div>
                    <div className="sale-items">
                      {sale.order_items?.map((item, index) => <span key={`${sale.id}-${index}`}>{item.quantity} x {item.name}</span>)}
                    </div>
                    <div className="sale-totals">
                      <span>Pago: <strong>{payment?.status || 'PENDIENTE'}</strong></span>
                      <span>Factura: <strong>{invoice?.number || (invoice ? 'En proceso' : 'No emitida')}</strong></span>
                      <strong>{formatCurrency.format(sale.total)}</strong>
                    </div>
                    {invoice?.public_url && <a href={invoice.public_url} target="_blank" rel="noreferrer">Ver documento</a>}
                  </article>
                )
              })}
            </section>
          )}
        </main>
      )}

      {showAuth && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAuth(false) }}>
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <div className="auth-modal-heading"><div><span>FactQR</span><h2 id="auth-title">{authMode === 'login' ? 'Iniciar sesion' : 'Crear cuenta'}</h2></div><button className="icon-button" type="button" onClick={() => setShowAuth(false)} aria-label="Cerrar"><Icon name="close" /></button></div>
            <form onSubmit={handleAuth}>
              {authMode === 'register' && <label>Nombre completo<input name="fullName" required autoComplete="name" /></label>}
              <label>Correo electronico<input name="email" type="email" required autoComplete="email" /></label>
              <label>Contrasena<input name="password" type="password" minLength={6} required autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} /></label>
              {error && <p className="form-error">{error}</p>}
              <button className="primary-button" type="submit">{authMode === 'login' ? 'Ingresar' : 'Registrarme'}</button>
            </form>
            <button className="auth-switch" type="button" onClick={() => { setError(''); setAuthMode(authMode === 'login' ? 'register' : 'login') }}>
              {authMode === 'login' ? 'No tienes cuenta? Registrate' : 'Ya tienes cuenta? Inicia sesion'}
            </button>
          </section>
        </div>
      )}

      {showAddProduct && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAddProduct(false) }}>
          <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="add-product-title">
            <div><div><span>Catalogo</span><h2 id="add-product-title">Agregar producto</h2></div><button className="icon-button" type="button" onClick={() => setShowAddProduct(false)} aria-label="Cerrar"><Icon name="close" /></button></div>
            <form onSubmit={handleAddProduct}>
              <label>Nombre<input name="name" required placeholder="Ej. Latte especial" /></label>
              <label>Precio COP<input name="price" type="number" min="10000" step="100" required placeholder="10000" /></label>
              <label>Categoria<select name="category">{categories.filter((item) => item !== 'Todos').map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Color visual<input name="color" type="color" defaultValue="#c99b73" /></label>
              <label className="full-field">Descripcion<textarea name="description" rows="3" placeholder="Describe brevemente el producto" /></label>
              {error && <p className="form-error full-field">{error}</p>}
              <button className="primary-button full-field" type="submit">Guardar producto</button>
            </form>
          </section>
        </div>
      )}
      <Footer />
    </div>
  )
}
