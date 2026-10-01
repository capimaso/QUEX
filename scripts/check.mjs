import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const files = [
  'src/main.jsx','src/App.jsx','src/lib/AuthContext.jsx','src/lib/supabase.js','src/api/client.js','src/components/GoogleButton.jsx','src/components/DocumentField.jsx','src/lib/validation/cpf.js','src/lib/validation/cnpj.js','src/pages/VerifyEmail.jsx','src/pages/AuthCallback.jsx','src/pages/CompleteProfile.jsx','src/api/data.js',
  'src/components/ui.jsx','src/components/AuthLayout.jsx','src/components/ProtectedRoute.jsx',
  'src/components/layout/AppLayout.jsx','src/components/layout/NavBar.jsx','src/components/products/ProductCard.jsx',
  'src/pages/Home.jsx','src/pages/Marketplace.jsx','src/pages/ProductDetail.jsx','src/pages/Login.jsx','src/pages/Register.jsx',
  'src/pages/ForgotPassword.jsx','src/pages/ResetPassword.jsx','src/pages/Cart.jsx','src/pages/Checkout.jsx','src/pages/Orders.jsx','src/pages/Profile.jsx','src/pages/NotFound.jsx',
  'src/pages/seller/ProductForm.jsx','src/pages/seller/SellerDashboard.jsx'
]

let errors = 0
for (const file of files) {
  const source = await readFile(file, 'utf8')
  const result = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
    fileName: file,
    reportDiagnostics: true,
  })
  const diagnostics = result.diagnostics || []
  if (diagnostics.length) {
    errors += diagnostics.length
    console.error(`FAIL ${file}`)
    for (const d of diagnostics) console.error(ts.flattenDiagnosticMessageText(d.messageText, '\n'))
  }
}
if (errors) process.exit(1)
console.log(`OK: ${files.length} source files parsed successfully.`)
