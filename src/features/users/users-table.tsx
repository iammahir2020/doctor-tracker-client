"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArchiveRestore, Loader2, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ConfirmDialog, EmptyState, Field, PageHeader } from "@/components/common";
import { DataTable, type Column } from "@/components/data-table";
import { FilterBar, SearchInput, SelectFilter } from "@/components/filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/features/auth/api";
import { ApiError, fieldErrors, type ManagedUser, type Role } from "@/lib/api";
import { cn, compact, formatDate, numberFormat, useUrlState } from "@/lib/utils";
import {
  useCreateUser,
  useSetUserArchived,
  useUpdateUser,
  useUsers,
  type UserListParams,
} from "./api";

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", staff: "Staff" };
const ROLE_OPTIONS = (["admin", "staff"] as const).map((r) => ({ value: r, label: ROLE_LABEL[r] }));

const COLUMNS: Column<ManagedUser>[] = [
  {
    id: "name",
    header: "Name",
    sortKey: "name",
    primary: true,
    cell: (u) => (
      <span className="flex items-center gap-2">
        <span className="font-medium">{u.name}</span>
        {u.isArchived && <Badge variant="outline">Archived</Badge>}
      </span>
    ),
  },
  { id: "email", header: "Email", cell: (u) => u.email },
  {
    id: "role",
    header: "Role",
    cell: (u) => (
      <Badge variant={u.role === "admin" ? "default" : "secondary"}>{ROLE_LABEL[u.role]}</Badge>
    ),
  },
  {
    id: "createdAt",
    header: "Added",
    sortKey: "createdAt",
    className: "whitespace-nowrap",
    cell: (u) => formatDate(u.createdAt),
  },
];

const FILTER_KEYS = ["search", "role"] as const;

// ---------- dialogs ----------

const passwordRule = z.string().min(8, "At least 8 characters").max(72, "At most 72 characters");

const createSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  email: z.email("Enter a valid email address"),
  password: passwordRule,
  role: z.enum(["admin", "staff"]),
});
type CreateValues = z.infer<typeof createSchema>;

// Editing only changes name and role; email and password aren't shown, so they aren't checked.
const editSchema = createSchema.extend({ email: z.string(), password: z.string() });
type EditValues = Pick<CreateValues, "name" | "role">;

function UserFormDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: ManagedUser;
}) {
  const create = useCreateUser();
  const update = useUpdateUser();
  const pending = create.isPending || update.isPending;
  const error = user ? update.error : create.error;
  const me = useCurrentUser();
  const isSelf = user?._id === me?.id;

  const form = useForm<CreateValues>({
    resolver: zodResolver(user ? editSchema : createSchema),
    defaultValues: { name: "", email: "", password: "", role: "staff" },
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (open) {
      reset(
        user
          ? { name: user.name, email: user.email, password: "", role: user.role }
          : { name: "", email: "", password: "", role: "staff" },
      );
      create.reset();
      update.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, user]);

  const onError = (err: unknown) => {
    const fields = fieldErrors(err);
    for (const name of ["name", "email", "password", "role"] as const) {
      if (fields[name]) setError(name, { message: fields[name] });
    }
    if (err instanceof ApiError && err.status === 409 && !user) {
      setError("email", { message: "A user with this email already exists" });
    }
  };

  const onSubmit = handleSubmit((values) => {
    if (user) {
      const input: EditValues = { name: values.name, role: values.role };
      update.mutate({ id: user._id, input }, { onSuccess: () => onOpenChange(false), onError });
    } else {
      create.mutate(values, { onSuccess: () => onOpenChange(false), onError });
    }
  });

  // Guard messages ("There must be at least one active admin") have no field to attach to.
  const formError =
    error instanceof ApiError &&
    Object.keys(fieldErrors(error)).length === 0 &&
    !(error.status === 409 && !user)
      ? error.message
      : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? "Edit user" : "Add user"}</DialogTitle>
          <DialogDescription>
            {user
              ? "Change this user's name or role."
              : "They sign in with this email and password. Share the password with them securely."}
          </DialogDescription>
        </DialogHeader>
        <form id="user-form" onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Full name" id="u-name" error={errors.name?.message}>
            <Input id="u-name" aria-invalid={!!errors.name} {...register("name")} />
          </Field>
          {!user && (
            <>
              <Field label="Email" id="u-email" error={errors.email?.message}>
                <Input
                  id="u-email"
                  type="email"
                  autoComplete="off"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
              </Field>
              <Field label="Temporary password" id="u-password" error={errors.password?.message}>
                <Input
                  id="u-password"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
              </Field>
            </>
          )}
          <Field label="Role" id="u-role" error={errors.role?.message}>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isSelf}>
                  <SelectTrigger id="u-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff: patients and read-only doctors</SelectItem>
                    <SelectItem value="admin">Admin: full access</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          {isSelf && (
            <p className="text-sm text-muted-foreground">You can&apos;t change your own role.</p>
          )}
        </form>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {user ? "Save changes" : "Add user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserRowActions({ user, onEdit }: { user: ManagedUser; onEdit: (u: ManagedUser) => void }) {
  const me = useCurrentUser();
  const [confirming, setConfirming] = useState(false);
  const setArchived = useSetUserArchived();
  const archive = !user.isArchived;
  const isSelf = user._id === me?.id;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.name}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!user.isArchived && (
            <DropdownMenuItem onSelect={() => onEdit(user)}>
              <Pencil aria-hidden /> Edit
            </DropdownMenuItem>
          )}
          {!isSelf && (
            <DropdownMenuItem onSelect={() => setConfirming(true)}>
              {archive ? <Archive aria-hidden /> : <ArchiveRestore aria-hidden />}
              {archive ? "Archive" : "Restore"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={archive ? `Archive ${user.name}?` : `Restore ${user.name}?`}
        description={
          archive
            ? "They will be signed out and can no longer sign in. Their account is kept and can be restored."
            : "They will be able to sign in again with their existing password."
        }
        confirmLabel={archive ? "Archive" : "Restore"}
        destructive={archive}
        onConfirm={() => setArchived.mutateAsync({ id: user._id, archive })}
      />
    </>
  );
}

// ---------- page ----------

export function UsersView() {
  const me = useCurrentUser();
  // Wait for the role, so staff never fire a request the server will refuse.
  if (!me) return <PageHeader title="Users" />;
  if (me.role !== "admin") {
    return (
      <>
        <PageHeader title="Users" />
        <EmptyState
          title="Admins only"
          description="Ask an admin if you need an account added or changed."
        />
      </>
    );
  }
  return <UsersList />;
}

function UsersList() {
  const url = useUrlState();
  const role = url.get("role");
  const sort = url.get("sort");
  const params: UserListParams = {
    search: url.get("search"),
    role: role === "admin" || role === "staff" ? role : undefined,
    sort: sort === "name" ? "name" : "createdAt",
    order: url.get("order") === "asc" ? "asc" : "desc",
    page: url.getNumber("page") ?? 1,
    pageSize: url.getNumber("pageSize") ?? 20,
    archived: url.get("archived") === "true",
  };
  const query = useUsers(compact(params) as UserListParams);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | undefined>();
  const hasFilters = url.has(FILTER_KEYS);

  const openForm = (user?: ManagedUser) => {
    setEditing(user);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title={params.archived ? "Archived users" : "Users"}
        description={
          query.data
            ? `${numberFormat.format(query.data.meta.total)} ${params.archived ? "archived" : "active"} users who can sign in`
            : "People who can sign in to Doctor Tracker."
        }
        actions={
          <Button onClick={() => openForm()}>
            <Plus aria-hidden /> Add user
          </Button>
        }
      />

      <FilterBar
        canClear={hasFilters}
        onClear={() => url.clear(FILTER_KEYS)}
        activeCount={FILTER_KEYS.filter((k) => k !== "search" && url.get(k)).length}
        search={
          <SearchInput
            label="Search users"
            placeholder="Search name or email…"
            value={params.search ?? ""}
            onChange={(search) => url.set({ search })}
          />
        }
      >
        <SelectFilter
          label="Roles"
          options={ROLE_OPTIONS}
          value={params.role}
          onChange={(r) => url.set({ role: r })}
        />
        <div className="flex items-center gap-2 sm:ml-auto">
          <Checkbox
            id="show-archived-users"
            checked={params.archived}
            onCheckedChange={(v) => url.set({ archived: v === true })}
          />
          <Label htmlFor="show-archived-users" className="font-normal">
            Show archived
          </Label>
        </div>
      </FilterBar>

      <DataTable
        caption="Users"
        columns={COLUMNS}
        data={query.data}
        getRowId={(u) => u._id}
        isPending={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        sort={{ sort: params.sort, order: params.order }}
        onSortChange={(s) => url.set({ sort: s.sort, order: s.order })}
        onPageChange={(page) => url.set({ page })}
        onPageSizeChange={(pageSize) => url.set({ pageSize })}
        rowActions={(u) => <UserRowActions user={u} onEdit={openForm} />}
        rowClassName={(u) => cn(u.isArchived && "text-muted-foreground")}
        empty={
          <EmptyState
            title={hasFilters ? "No users match these filters" : "No users"}
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={() => url.clear(FILTER_KEYS)}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
      />

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} />
    </>
  );
}
