import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

const products = [
  { id: 'coffee', name: 'Americano', price: 10000 },
  { id: 'sandwich', name: 'Sandwich', price: 12000 },
  { id: 'juice', name: 'Jugo natural', price: 10000 },
  { id: 'cake', name: 'Porcion de torta', price: 12000 },
]

const formatCurrency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

const paymentFunctionUrl =
  'https://pvbpqowxjpqjkjwglkes.supabase.co/functions/v1/create-payment'
const paymentStatusFunctionUrl =
  'https://pvbpqowxjpqjkjwglkes.supabase.co/functions/v1/payment-status'
const simulatePaymentFunctionUrl =
  'https://pvbpqowxjpqjkjwglkes.supabase.co/functions/v1/simulate-payment'
const issueInvoiceFunctionUrl =
  'https://pvbpqowxjpqjkjwglkes.supabase.co/functions/v1/issue-invoice'

export default function App() {
  const [cart, setCart] = useState({})
  const [payment, setPayment] = useState(null)
  const [error, setError] = useState('')
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false)
  const [isIssuingInvoice, setIsIssuingInvoice] = useState(false)
  const [invoice, setInvoice] = useState(null)

  useEffect(() => {
    if (!payment?.referenceCode || payment.status !== 'READY') return undefined

    const pollPayment = async () => {
      try {
        const response = await fetch(
          `${paymentStatusFunctionUrl}?reference=${encodeURIComponent(payment.referenceCode)}`,
        )
        const result = await response.json()

        if (response.ok && result.data?.status === 'PAID') {
          setPayment((current) => ({ ...current, status: 'PAID' }))
        }
      } catch {
        // Keep the last UI state when a polling request fails.
      }
    }

    const intervalId = window.setInterval(pollPayment, 3000)
    return () => window.clearInterval(intervalId)
  }, [payment?.referenceCode, payment?.status])

  const items = useMemo(
    () =>
      products
        .filter((product) => cart[product.id])
        .map((product) => ({ ...product, quantity: cart[product.id] })),
    [cart],
  )

  const total = items.reduce(
    (sum, product) => sum + product.price * product.quantity,
    0,
  )

  const itemCount = items.reduce((sum, product) => sum + product.quantity, 0)

  const addProduct = (productId) => {
    setCart((current) => ({
      ...current,
      [productId]: (current[productId] || 0) + 1,
    }))
  }

  const removeProduct = (productId) => {
    setCart((current) => {
      const nextQuantity = (current[productId] || 0) - 1

      if (nextQuantity <= 0) {
        const { [productId]: removed, ...remaining } = current
        return remaining
      }

      return { ...current, [productId]: nextQuantity }
    })
  }

  const handleCreatePayment = async () => {
    setError('')
    setIsCreatingPayment(true)
    setPayment(null)

    try {
      const response = await fetch(paymentFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'A',
          items: items.map((product) => ({
            code: product.id,
            name: product.name,
            price: product.price,
            quantity: product.quantity,
          })),
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'No se pudo crear el cobro.')
      }

      setPayment(result.data)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No se pudo crear el cobro.',
      )
    } finally {
      setIsCreatingPayment(false)
    }

  }

  const handleSimulatePayment = async () => {
    if (!payment) return

    setError('')
    setIsSimulatingPayment(true)

    try {
      const response = await fetch(simulatePaymentFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: payment.referenceCode }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'No se pudo simular el pago.')
      }

      setPayment((current) => ({ ...current, status: 'PAID' }))
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No se pudo simular el pago.',
      )
    } finally {
      setIsSimulatingPayment(false)
    }
  }

  const handleIssueInvoice = async () => {
    if (!payment) return

    setError('')
    setIsIssuingInvoice(true)

    try {
      const response = await fetch(issueInvoiceFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: payment.referenceCode }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'No se pudo emitir la factura.')
      }

      setInvoice(result.data)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No se pudo emitir la factura.',
      )
    } finally {
      setIsIssuingInvoice(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Sandbox POS</p>
          <h1>FactQR</h1>
        </div>
        <span className="status-pill">Listo para integrar</span>
      </header>

      <section className="workspace">
        <div className="catalog-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Catalogo demo</p>
              <h2>Productos</h2>
            </div>
            <span>{products.length} items</span>
          </div>

          <div className="product-grid">
            {products.map((product) => (
              <article className="product-card" key={product.id}>
                <span className="product-code">{product.id.toUpperCase()}</span>
                <h3>{product.name}</h3>
                <strong>{formatCurrency.format(product.price)}</strong>
                <button type="button" onClick={() => addProduct(product.id)}>
                  Agregar
                </button>
              </article>
            ))}
          </div>
        </div>

        <aside className="ticket-panel">
          <p className="eyebrow">Nueva venta</p>
          <h2>Ticket</h2>
          {itemCount === 0 ? (
            <div className="empty-ticket">
              <span>0</span>
              <p>Agrega productos para comenzar</p>
            </div>
          ) : (
            <div className="ticket-items">
              {items.map((product) => (
                <div className="ticket-item" key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>
                      {product.quantity} x {formatCurrency.format(product.price)}
                    </span>
                  </div>
                  <div className="ticket-item-actions">
                    <button
                      type="button"
                      aria-label={`Eliminar una unidad de ${product.name}`}
                      onClick={() => removeProduct(product.id)}
                    >
                      -
                    </button>
                    <strong>
                      {formatCurrency.format(product.price * product.quantity)}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          )}

          <fieldset>
            <legend>Modo de cobro</legend>
            <label>
              <input type="radio" name="mode" defaultChecked />
              Cobrar primero
            </label>
            <label>
              <input type="radio" name="mode" />
              Facturar primero
            </label>
          </fieldset>

          <div className="total-row">
            <span>Total</span>
            <strong>{formatCurrency.format(total)}</strong>
          </div>
          {payment && (
            <div className="payment-result">
              <span>{payment.provider === 'FACTUS_PAY' ? 'QR de Factus Pay' : 'QR de simulacion'}</span>
              {payment.qr && payment.qr.startsWith('data:image/') ? (
                <div className="qr-code" aria-label={`Codigo QR ${payment.referenceCode}`}>
                  <img src={payment.qr} alt="QR de Factus Pay" width="180" height="180" />
                </div>
              ) : payment.qr && (
                <div className="qr-code" aria-label={`Codigo QR ${payment.referenceCode}`}>
                  <QRCodeSVG
                    value={payment.qr}
                    size={180}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#111318"
                  />
                </div>
              )}
              <strong>{payment.referenceCode}</strong>
              <small>{formatCurrency.format(payment.amount)} · {payment.status}</small>
            </div>
          )}
          {payment?.status === 'READY' && (
            <button
              className="secondary-button"
              type="button"
              disabled={isSimulatingPayment}
              onClick={handleSimulatePayment}
            >
              {isSimulatingPayment ? 'Confirmando...' : 'Simular pago aprobado'}
            </button>
          )}
          {payment?.status === 'PAID' && (
            <button
              className="primary-button"
              type="button"
              disabled={isIssuingInvoice}
              onClick={handleIssueInvoice}
            >
              {isIssuingInvoice ? 'Facturando...' : 'Emitir factura demo'}
            </button>
          )}
          {invoice && (
            <div className="payment-result">
              <span>Factura validada</span>
              <strong>{invoice.number}</strong>
              {invoice.publicUrl && (
                <a href={invoice.publicUrl} target="_blank" rel="noreferrer">
                  Ver documento
                </a>
              )}
            </div>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          {!payment && (
            <button
              className="primary-button"
              type="button"
              disabled={!total || isCreatingPayment}
              onClick={handleCreatePayment}
            >
              {isCreatingPayment ? 'Creando...' : 'Generar QR'}
            </button>
          )}
        </aside>
      </section>
    </main>
  )
}
