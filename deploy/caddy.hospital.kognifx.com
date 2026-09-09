# Snippet for kognifx-caddy (host network). Applied on the VPS Caddyfile.
# Do not replace other site blocks.

hospital.kognifx.com {
	encode gzip zstd
	reverse_proxy 127.0.0.1:8088
}
