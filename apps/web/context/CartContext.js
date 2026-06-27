'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createBrowserSupabase } from '@optex/db/browser'
import {
  getCartView,
  addCartItem,
  updateCartItemQuantity,
  removeCartItem,
} from '@optex/db'

const CartContext = createContext()

export const useCart = () => useContext(CartContext)

function dbItemToCartItem(item) {
  return {
    id: item.id,
    productId: item.product_id,
    title: item.product.name,
    price: String(item.product.price_kes),
    image: item.product.images?.[0] ?? '',
    quantity: item.quantity,
    brand: item.product.brand ?? '',
    variant: item.lens_option ? JSON.stringify(item.lens_option) : '',
  }
}

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([])
  const [cartId, setCartId] = useState(null)
  const [userId, setUserId] = useState(null)

  const supabase = createBrowserSupabase()

  // Sync with auth state and load DB cart when logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null
      setUserId(uid)
      if (uid) loadDbCart(uid)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null
      setUserId(uid)
      if (uid) {
        loadDbCart(uid)
      } else {
        // Logged out — clear cart
        setItems([])
        setCartId(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadDbCart(uid) {
    try {
      const view = await getCartView(supabase, uid)
      if (view) {
        setCartId(view.cartId)
        setItems(view.items.map(dbItemToCartItem))
      }
    } catch (err) {
      console.error('Cart load error:', err)
    }
  }

  const addToCart = async (product) => {
    if (userId) {
      try {
        await addCartItem(supabase, {
          customerId: userId,
          productId: product.id,
          quantity: product.quantity ?? 1,
        })
        await loadDbCart(userId)
      } catch (err) {
        console.error('addCartItem error:', err)
      }
    } else {
      // Guest — in-memory only
      setItems((prev) => {
        const existing = prev.find((i) => i.id === product.id)
        if (existing) {
          return prev.map((i) =>
            i.id === product.id ? { ...i, quantity: i.quantity + (product.quantity ?? 1) } : i,
          )
        }
        return [...prev, { ...product, quantity: product.quantity ?? 1 }]
      })
    }
  }

  const updateQuantity = async (id, delta) => {
    const item = items.find((i) => i.id === id)
    if (!item) return
    const newQty = Math.max(1, item.quantity + delta)
    if (userId) {
      try {
        await updateCartItemQuantity(supabase, id, newQty)
        await loadDbCart(userId)
      } catch (err) {
        console.error('updateCartItemQuantity error:', err)
      }
    } else {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: newQty } : i)))
    }
  }

  const removeItem = async (id) => {
    if (userId) {
      try {
        await removeCartItem(supabase, id)
        await loadDbCart(userId)
      } catch (err) {
        console.error('removeCartItem error:', err)
      }
    } else {
      setItems((prev) => prev.filter((i) => i.id !== id))
    }
  }

  const cartCount = items.reduce((count, item) => count + item.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addToCart, updateQuantity, removeItem, cartCount, cartId }}>
      {children}
    </CartContext.Provider>
  )
}
