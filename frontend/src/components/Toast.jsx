import { Toaster } from 'react-hot-toast'

export default function Toast() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: { fontSize: '14px', maxWidth: '380px' },
        success: { iconTheme: { primary: '#c9a227', secondary: '#fff' } },
      }}
    />
  )
}
