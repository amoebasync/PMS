'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export type CartItem = {
  id: string;
  type: 'POSTING_ONLY' | 'PRINT_AND_POSTING';
  title: string;
  selectedAreas: any[];
  totalCount: number;
  method: string;
  size: string;
  price: number;
  unitPrice: number;
  startDate: string;
  endDate: string;
  spareDate: string;
  projectName?: string;
  flyerId?: string;
  savedOrderId?: number;
  // 印刷仕様 (PRINT_AND_POSTING のみ)
  foldingTypeId?: number;
  foldingTypeName?: string;
  foldingUnitPrice?: number;
  paperType?: string;
  paperWeight?: string;
  colorType?: string;
  printCount?: number;
  flyerName?: string;
  industryId?: number;
  foldStatus?: string;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id'>) => void;
  updateItem: (id: string, updates: Partial<CartItem>) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  totalAmount: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const userId = (session?.user as any)?.id as string | undefined;
  // ユーザーごとに独立したキーを使うことで、アカウント間のカート混在を防ぐ
  const cartKey = `pms_cart_${userId ?? 'guest'}`;

  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // セッションが確定したら、そのユーザー専用のカートをロード
  useEffect(() => {
    if (status === 'loading') return;
    setIsLoaded(false);
    const saved = localStorage.getItem(cartKey);
    const parsed: CartItem[] = (() => {
      try { return saved ? JSON.parse(saved) : []; } catch { return []; }
    })();
    setItems(parsed);
    setIsLoaded(true);
  }, [cartKey, status]);

  // カートの変更をlocalStorageに保存
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(cartKey, JSON.stringify(items));
  }, [items, isLoaded, cartKey]);

  const addItem = (item: Omit<CartItem, 'id'>) => {
    const newItem = { ...item, id: crypto.randomUUID() };
    setItems(prev => [...prev, newItem]);
  };

  const updateItem = (id: string, updates: Partial<CartItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => setItems([]);

  const totalAmount = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <CartContext.Provider value={{ items, addItem, updateItem, removeItem, clearCart, totalAmount }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
