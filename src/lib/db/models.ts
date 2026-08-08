import { Schema, models, model } from "mongoose";

const timestamps = { createdAt: "created_at", updatedAt: "updated_at" } as const;

const companySchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    website: { type: String, default: null },
    industry: { type: String, default: null },
    address: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    created_by: { type: String, default: null },
    deleted_at: { type: Date, default: null },
  },
  { timestamps }
);

const clientSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    company_id: { type: String, default: null, index: true },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    website: { type: String, default: null },
    address: { type: String, default: null },
    industry: { type: String, default: null },
    budget: { type: Number, default: 0 },
    deadline: { type: String, default: null },
    requirements: { type: String, default: null },
    notes: { type: String, default: null },
    status: {
      type: String,
      enum: ["lead", "active", "inactive", "archived"],
      default: "lead",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    created_by: { type: String, default: null },
    assigned_manager_id: { type: String, default: null, index: true },
    /** Linked portal login user (role: client). */
    portal_user_id: { type: String, default: null, index: true },
    deleted_at: { type: Date, default: null },
  },
  { timestamps }
);

const projectSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    client_id: { type: String, required: true, index: true },
    description: { type: String, default: null },
    budget: { type: Number, default: 0 },
    deadline: { type: String, default: null },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["planning", "in_progress", "on_hold", "completed", "cancelled"],
      default: "planning",
      index: true,
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    created_by: { type: String, default: null },
    manager_id: { type: String, default: null, index: true },
    member_ids: { type: [String], default: [] },
    deleted_at: { type: Date, default: null },
  },
  { timestamps }
);

const taskSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    project_id: { type: String, required: true, index: true },
    assigned_to: { type: String, default: null, index: true },
    /** Multi-assignee support (WhatsApp-style groups). */
    assignee_ids: { type: [String], default: [] },
    group_id: { type: String, default: null, index: true },
    due_date: { type: String, default: null },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "review", "done", "cancelled"],
      default: "todo",
      index: true,
    },
    created_by: { type: String, default: null },
    deleted_at: { type: Date, default: null },
  },
  { timestamps }
);

const taskCommentSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    task_id: { type: String, required: true, index: true },
    user_id: { type: String, required: true },
    content: { type: String, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

const documentSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    file_path: { type: String, required: true },
    file_size: { type: Number, default: null },
    mime_type: { type: String, default: null },
    entity_type: {
      type: String,
      enum: ["client", "company", "project", "task", "user", "document"],
      required: true,
    },
    entity_id: { type: String, required: true, index: true },
    uploaded_by: { type: String, default: null },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

const activityLogSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    actor_id: { type: String, default: null },
    action: { type: String, required: true },
    entity_type: {
      type: String,
      enum: [
        "client",
        "company",
        "project",
        "task",
        "user",
        "document",
        "meeting",
      ],
      required: true,
    },
    entity_id: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

const projectMeetingSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    project_id: { type: String, required: true, index: true },
    client_id: { type: String, required: true, index: true },
    title: { type: String, required: true },
    agenda: { type: String, default: null },
    notes: { type: String, default: null },
    scheduled_at: { type: String, required: true, index: true },
    duration_minutes: { type: Number, default: 30 },
    location: { type: String, default: null },
    meeting_url: { type: String, default: null },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
      index: true,
    },
    created_by: { type: String, default: null },
    manager_id: { type: String, default: null, index: true },
    visible_to_client: { type: Boolean, default: true },
    deleted_at: { type: Date, default: null },
  },
  { timestamps }
);

const notificationSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: "info" },
    link: { type: String, default: null },
    read_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

const feedbackSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    client_id: { type: String, required: true, index: true },
    submitted_by: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["feedback", "feature"],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["new", "reviewed", "planned", "done", "dismissed"],
      default: "new",
      index: true,
    },
    /** Internal-only note (not shown to client). */
    staff_notes: { type: String, default: null },
    /** Reply message shown to the client. */
    reply: { type: String, default: null },
    seen_at: { type: Date, default: null },
    seen_by: { type: String, default: null },
    deleted_at: { type: Date, default: null },
  },
  { timestamps }
);

const workGroupSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    project_id: { type: String, required: true, index: true },
    created_by: { type: String, required: true, index: true },
    member_user_ids: { type: [String], default: [] },
    member_client_ids: { type: [String], default: [] },
    deleted_at: { type: Date, default: null },
  },
  { timestamps }
);

const groupMessageSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    group_id: { type: String, required: true, index: true },
    sender_user_id: { type: String, required: true, index: true },
    /** Text can be empty when only an attachment is sent. */
    body: { type: String, default: "" },
    attachments: {
      type: [
        {
          file_path: { type: String, required: true },
          file_name: { type: String, required: true },
          mime_type: { type: String, default: null },
          size: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export const CompanyModel =
  models.Company || model("Company", companySchema, "companies");
export const ClientModel =
  models.Client || model("Client", clientSchema, "clients");
export const ProjectModel =
  models.Project || model("Project", projectSchema, "projects");
export const TaskModel = models.Task || model("Task", taskSchema, "tasks");
export const TaskCommentModel =
  models.TaskComment || model("TaskComment", taskCommentSchema, "task_comments");
export const DocumentModel =
  models.Document || model("Document", documentSchema, "documents");
export const ActivityLogModel =
  models.ActivityLog || model("ActivityLog", activityLogSchema, "activity_logs");
export const ProjectMeetingModel =
  models.ProjectMeeting ||
  model("ProjectMeeting", projectMeetingSchema, "project_meetings");
export const NotificationModel =
  models.Notification ||
  model("Notification", notificationSchema, "notifications");
export const FeedbackModel =
  models.Feedback || model("Feedback", feedbackSchema, "feedback");
export const WorkGroupModel =
  models.WorkGroup || model("WorkGroup", workGroupSchema, "work_groups");
export const GroupMessageModel =
  models.GroupMessage ||
  model("GroupMessage", groupMessageSchema, "group_messages");

export function newId() {
  return crypto.randomUUID();
}

export function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}
