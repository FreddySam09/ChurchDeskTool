import { supabase } from "../../../lib/supabase";

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error("Please sign in to use Reports.");

  return data.user;
}

export async function getSavedReports() {
  const user = await requireUser();

  return unwrap(
    await supabase
      .from("report_saved_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
  ) ?? [];
}

export async function saveReportDefinition({ id, name, source, fields, filters, sorts }) {
  const user = await requireUser();
  const cleanName = String(name ?? "").trim();

  if (!cleanName) throw new Error("Enter a name for this saved report.");
  if (!source || !Array.isArray(fields) || fields.length === 0) {
    throw new Error("Choose a report source and at least one output column.");
  }

  const payload = {
    user_id: user.id,
    name: cleanName,
    source,
    definition: { source, fields, filters, sorts },
    updated_at: new Date().toISOString(),
  };

  const query = id
    ? supabase
        .from("report_saved_reports")
        .update(payload)
        .eq("id", id)
        .eq("user_id", user.id)
    : supabase.from("report_saved_reports").insert(payload);

  return unwrap(await query.select("*").single());
}

export async function deleteSavedReport(id) {
  const user = await requireUser();

  return unwrap(
    await supabase
      .from("report_saved_reports")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id),
  );
}

export async function recordReportExport({
  source,
  reportName,
  format,
  filters,
  fields,
  sorts,
  rowCount,
}) {
  const user = await requireUser();

  return unwrap(
    await supabase.from("report_export_audit").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      source,
      report_name: reportName,
      export_format: format,
      filters: filters ?? [],
      fields: fields ?? [],
      sorts: sorts ?? [],
      row_count: rowCount,
    }),
  );
}

export async function getMyExportHistory() {
  const user = await requireUser();

  return unwrap(
    await supabase
      .from("report_export_audit")
      .select("id, source, report_name, export_format, row_count, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ) ?? [];
}