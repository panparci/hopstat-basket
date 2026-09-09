# Snippet for kognifx-caddy (host network). Applied on the VPS Caddyfile.
# Do not replace other site blocks.

hoopstats.kognifx.com {
	encode gzip zstd
	reverse_proxy 127.0.0.1:8088
}

hospital.kognifx.com {
	redir https://hoopstats.kognifx.com{uri} permanent
}
