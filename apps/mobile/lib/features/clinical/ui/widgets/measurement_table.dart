import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';

/// One cell of a prescription card.
typedef RxCell = ({String label, String value});

/// A read-only prescription grid, laid out the way an optician's card is.
///
/// Rows are eyes (OD then OS — right before left, as written on every
/// prescription in the world), columns are measurements. Rendered as a real
/// table rather than a wrapped list of chips so a customer can check their own
/// numbers against the paper in their hand without hunting.
///
/// Scrolls horizontally on purpose: five columns do not fit a 360 px phone at a
/// legible size, and shrinking the text on a clinical value to make it fit is
/// the wrong trade.
class MeasurementTable extends StatelessWidget {
  const MeasurementTable({
    super.key,
    required this.columns,
    required this.rightEye,
    required this.leftEye,
  });

  /// Column headings, e.g. `SPH`, `CYL`, `AXIS`, `ADD`, `PD`.
  final List<String> columns;

  /// Values for OD, same length and order as [columns]. An em dash for blanks.
  final List<String> rightEye;

  /// Values for OS.
  final List<String> leftEye;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final TextStyle? head = theme.textTheme.labelSmall?.copyWith(
      color: theme.colorScheme.outline,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.6,
    );
    final TextStyle? cell = theme.textTheme.bodyMedium?.copyWith(
      fontWeight: FontWeight.w600,
      fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
    );

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        headingRowHeight: 34,
        dataRowMinHeight: 38,
        dataRowMaxHeight: 44,
        horizontalMargin: 0,
        columnSpacing: AppSpacing.lg,
        dividerThickness: 0.5,
        columns: <DataColumn>[
          DataColumn(label: Text('EYE', style: head)),
          for (final String column in columns)
            DataColumn(label: Text(column, style: head)),
        ],
        rows: <DataRow>[
          _row(context, 'Right (OD)', rightEye, cell),
          _row(context, 'Left (OS)', leftEye, cell),
        ],
      ),
    );
  }

  DataRow _row(
    BuildContext context,
    String label,
    List<String> values,
    TextStyle? cell,
  ) => DataRow(
    cells: <DataCell>[
      DataCell(
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
      ),
      for (int i = 0; i < columns.length; i++)
        DataCell(Text(i < values.length ? values[i] : '—', style: cell)),
    ],
  );
}

/// Formats an optional measurement for display.
///
/// Sphere, cylinder and add carry a sign on a real prescription — `+1.25` is a
/// different lens from `-1.25`, and dropping the plus makes them look
/// identical at a glance. Zero stays unsigned.
String formatSigned(double? value, {int decimals = 2}) {
  if (value == null) return '—';
  final String text = value.abs().toStringAsFixed(decimals);
  if (value > 0) return '+$text';
  if (value < 0) return '-$text';
  return text;
}

/// Formats an unsigned measurement (axis, PD).
String formatPlain(num? value, {int decimals = 0}) {
  if (value == null) return '—';
  return decimals == 0
      ? value.round().toString()
      : value.toDouble().toStringAsFixed(decimals);
}
