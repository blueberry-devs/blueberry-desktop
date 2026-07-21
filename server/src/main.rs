mod cache;
mod lyrics;
mod routes;
mod soundcloud;
mod spotify;
mod types;
mod yandex;
mod youtube;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_target(true)
        .init();

    dotenvy::dotenv().ok();

    let port: u16 = std::env::var("SIDECAR_PORT")
        .unwrap_or_else(|_| "8787".to_string())
        .parse()
        .unwrap_or(8787);

    let state = cache::new_state().await;
    let app = routes::router(state);

    let addr = format!("127.0.0.1:{port}");
    tracing::info!("sidecar starting on http://{addr}");

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind address");

    axum::serve(listener, app)
        .await
        .expect("Server error");
}
