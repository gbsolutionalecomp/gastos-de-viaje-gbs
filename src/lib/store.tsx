'use client'

import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import { Gasto, Reporte, Usuario } from '@/types'

interface AppState {
  user: Usuario | null
  gastos: Gasto[]
  reportes: Reporte[]
  loading: boolean
}

type Action =
  | { type: 'SET_USER'; payload: Usuario | null }
  | { type: 'SET_GASTOS'; payload: Gasto[] }
  | { type: 'ADD_GASTO'; payload: Gasto }
  | { type: 'UPDATE_GASTO'; payload: Gasto }
  | { type: 'DELETE_GASTO'; payload: string }
  | { type: 'SET_REPORTES'; payload: Reporte[] }
  | { type: 'SET_LOADING'; payload: boolean }

const initialState: AppState = {
  user: null,
  gastos: [],
  reportes: [],
  loading: false,
}

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload }
    case 'SET_GASTOS':
      return { ...state, gastos: action.payload }
    case 'ADD_GASTO':
      return { ...state, gastos: [action.payload, ...state.gastos] }
    case 'UPDATE_GASTO':
      return {
        ...state,
        gastos: state.gastos.map((g) => (g.id === action.payload.id ? action.payload : g)),
      }
    case 'DELETE_GASTO':
      return {
        ...state,
        gastos: state.gastos.filter((g) => g.id !== action.payload),
      }
    case 'SET_REPORTES':
      return { ...state, reportes: action.payload }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    default:
      return state
  }
}

const AppContext = createContext<{
  state: AppState
  dispatch: React.Dispatch<Action>
}>({
  state: initialState,
  dispatch: () => null,
})

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, initialState)

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}

export const useAppStore = () => useContext(AppContext)
