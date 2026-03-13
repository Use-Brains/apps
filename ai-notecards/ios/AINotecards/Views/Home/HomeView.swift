import SwiftUI

struct HomeView: View {
    var body: some View {
        TabView {
            Tab("Home", systemImage: "house.fill") {
                NavigationStack {
                    DashboardView()
                }
            }

            Tab("Generate", systemImage: "sparkles") {
                NavigationStack {
                    GenerateView()
                }
            }

            Tab("Marketplace", systemImage: "storefront.fill") {
                NavigationStack {
                    MarketplaceView()
                }
            }

            Tab("Settings", systemImage: "gearshape.fill") {
                NavigationStack {
                    SettingsView()
                }
            }
        }
        .tint(Color("AccentGreen"))
    }
}
