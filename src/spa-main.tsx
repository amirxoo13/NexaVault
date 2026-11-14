import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { AdminGate } from "@/components/admin-gate";
import { AuthGate } from "@/components/auth-gate";
import { BrandHead } from "@/components/brand-head";
import { DeviceLockHost } from "@/components/device-lock";
import { PersistHydrate } from "@/components/persist-hydrate";
import { PwaRegister } from "@/components/pwa-register";
import { WalletShell } from "@/components/wallet-shell";
import { t } from "@/lib/i18n";
import { EthAccountScreen } from "@/screens/eth-account";
import { FeaturesScreen } from "@/screens/features";
import { WelcomeScreen } from "@/screens/welcome";
import { LoginScreen } from "@/screens/login";
import { MarketsScreen } from "@/screens/markets";
import { PerpsScreen } from "@/screens/perps";
import { SecurityScreen } from "@/screens/security";
import { StudioScreen } from "@/screens/studio";
import { WalletActivityScreen } from "@/screens/wallet-activity";
import { WalletAssetScreen } from "@/screens/wallet-asset";
import { WalletBuyScreen } from "@/screens/wallet-buy";
import { WalletHomeScreen } from "@/screens/wallet-home";
import { WalletProfileScreen } from "@/screens/wallet-profile";
import { WalletReceiveScreen } from "@/screens/wallet-receive";
import { WalletSendScreen } from "@/screens/wallet-send";
import { WalletSettingsScreen } from "@/screens/wallet-settings";
import { WalletSwapScreen } from "@/screens/wallet-swap";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

const rootRoute = createRootRoute({
  component: () => (
    <>
      <PersistHydrate />
      <BrandHead />
      <PwaRegister />
      <DeviceLockHost />
      <Outlet />
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          style: {
            background: "#0d131c",
            color: "#eef4f8",
            border: "1px solid rgb(16 185 129 / 0.22)",
          },
        }}
      />
    </>
  ),
});

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: WelcomeScreen });
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: LoginScreen });
const marketsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/markets", component: MarketsScreen });
const featuresRoute = createRoute({ getParentRoute: () => rootRoute, path: "/features", component: FeaturesScreen });
const securityRoute = createRoute({ getParentRoute: () => rootRoute, path: "/security", component: SecurityScreen });
const studioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/studio",
  component: () => (
    <AdminGate>
      <StudioScreen />
    </AdminGate>
  ),
});

const walletRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/wallet",
  component: () => (
    <AuthGate>
      <Outlet />
    </AuthGate>
  ),
});

const walletIndex = createRoute({ getParentRoute: () => walletRoute, path: "/", component: WalletHomeScreen });
const walletSend = createRoute({ getParentRoute: () => walletRoute, path: "/send", component: WalletSendScreen });
const walletReceive = createRoute({
  getParentRoute: () => walletRoute,
  path: "/receive",
  component: WalletReceiveScreen,
});
const walletSwap = createRoute({ getParentRoute: () => walletRoute, path: "/swap", component: WalletSwapScreen });
const walletBuy = createRoute({ getParentRoute: () => walletRoute, path: "/buy", component: WalletBuyScreen });
const walletPerps = createRoute({ getParentRoute: () => walletRoute, path: "/perps", component: PerpsScreen });
const walletEthereum = createRoute({ getParentRoute: () => walletRoute, path: "/ethereum", component: EthAccountScreen });
const walletActivity = createRoute({
  getParentRoute: () => walletRoute,
  path: "/activity",
  component: WalletActivityScreen,
});
const walletProfile = createRoute({
  getParentRoute: () => walletRoute,
  path: "/profile",
  component: WalletProfileScreen,
});
const walletSettings = createRoute({
  getParentRoute: () => walletRoute,
  path: "/settings",
  component: WalletSettingsScreen,
});
const walletMarkets = createRoute({
  getParentRoute: () => walletRoute,
  path: "/markets",
  component: function WalletMarketsPage() {
    return (
      <WalletShell title={t().wallet.markets}>
        <MarketsScreen embedded />
      </WalletShell>
    );
  },
});
const walletAsset = createRoute({
  getParentRoute: () => walletRoute,
  path: "/asset/$id",
  component: function AssetPage() {
    const { id } = walletAsset.useParams();
    return <WalletAssetScreen id={id} />;
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  marketsRoute,
  featuresRoute,
  securityRoute,
  studioRoute,
  walletRoute.addChildren([
    walletIndex,
    walletSend,
    walletReceive,
    walletSwap,
    walletBuy,
    walletPerps,
    walletEthereum,
    walletActivity,
    walletProfile,
    walletSettings,
    walletMarkets,
    walletAsset,
  ]),
]);

const router = createRouter({
  routeTree,
  history: createHashHistory(),
});

const el = document.getElementById("root");
if (el) {
  createRoot(el).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}
