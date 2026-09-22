import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../core/theme/app_spacing.dart';

/// Pesapal's hosted payment page, in an in-app webview.
///
/// This screen collects a payment; it does not decide anything about one.
/// Whatever it navigates to, and however it closes, the caller re-queries
/// `GET /payments/pesapal/status` and takes the server's answer. A redirect
/// URL is a string a browser was told to load — it is not evidence that money
/// moved, and treating it as such is how a payment page becomes a free-money
/// exploit.
///
/// Closing it is therefore always safe: the customer can back out at any
/// point and the app will still find out what really happened.
class PesapalWebViewScreen extends StatefulWidget {
  const PesapalWebViewScreen({super.key, required this.redirectUrl});

  final String redirectUrl;

  @override
  State<PesapalWebViewScreen> createState() => _PesapalWebViewScreenState();
}

class _PesapalWebViewScreenState extends State<PesapalWebViewScreen> {
  late final WebViewController _controller;
  bool _loading = true;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (mounted) setState(() => _loading = true);
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
          onWebResourceError: (WebResourceError error) {
            // Sub-resource failures are noisy and mostly harmless; only a
            // failure of the page itself is worth telling the customer about.
            if (error.isForMainFrame == false) return;
            if (mounted) {
              setState(() {
                _loading = false;
                _loadError =
                    'The payment page could not be loaded. '
                    'Close this and try again — nothing has been charged.';
              });
            }
          },
          onNavigationRequest: (NavigationRequest request) {
            if (_isReturnToUs(request.url)) {
              _close();
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.redirectUrl));
  }

  /// Whether this navigation is Pesapal handing the customer back to us.
  ///
  /// Matched on the `OrderTrackingId` parameter Pesapal appends to the
  /// merchant callback, *not* on "the host changed" — 3-D Secure sends the
  /// customer to their bank's domain mid-payment, and closing the window there
  /// would strand them. A custom scheme (`optex://…`) is also a return, since
  /// a webview cannot load one anyway.
  static bool _isReturnToUs(String url) {
    final Uri? uri = Uri.tryParse(url);
    if (uri == null) return false;
    if (uri.scheme != 'http' && uri.scheme != 'https') return true;
    if (uri.host.contains('pesapal.com')) return false;
    return uri.queryParameters.keys.any(
      (String key) => key.toLowerCase() == 'ordertrackingid',
    );
  }

  void _close() {
    if (!mounted) return;
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Secure payment'),
        leading: IconButton(
          icon: const Icon(Icons.close_rounded),
          tooltip: 'Close',
          onPressed: _close,
        ),
        bottom: _loading
            ? const PreferredSize(
                preferredSize: Size.fromHeight(2),
                child: LinearProgressIndicator(minHeight: 2),
              )
            : null,
      ),
      body: Column(
        children: <Widget>[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.sm),
            color: theme.colorScheme.surfaceContainerHighest,
            child: Text(
              'Pesapal · ${Uri.tryParse(widget.redirectUrl)?.host ?? ''}',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
          ),
          if (_loadError != null)
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Text(
                _loadError!,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.error,
                ),
              ),
            ),
          Expanded(child: WebViewWidget(controller: _controller)),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: OutlinedButton(
                onPressed: _close,
                child: const Text("I've finished paying"),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
