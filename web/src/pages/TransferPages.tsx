import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Clock3,
  Download,
  FileCheck,
  FileText,
  Filter,
  GraduationCap,
  History,
  Info,
  Loader2,
  MoveRight,
  Plus,
  RefreshCw,
  School as SchoolIcon,
  Search,
  Send,
  Sparkles,
  UserCheck,
  Users,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api, apiBlob } from "../lib/api";

type StudentRow = {
  id: string;
  enrollmentId: string;
  permanentId: string;
  name: string;
  gender: string;
  dateOfBirth: string;
  status: string;
  photoUrl: string | null;
  level: string;
  section: string;
  year: string;
  rollNumber: number | null;
};

type Placement = {
  id: string;
  name: string;
  isCurrent?: boolean;
  classes: Array<{
    id: string;
    level: string;
    label: string;
    sections: Array<{ id: string; name: string }>;
  }>;
};

type School = {
  id: string;
  name: string;
  code: string;
  type: "PRIMARY_ONLY" | "SECONDARY_ONLY" | "PRIMARY_AND_SECONDARY";
};

type Transfer = {
  id: string;
  studentId: string;
  permanentId: string;
  name: string;
  fromSchool: string;
  toSchool: string;
  status: string;
  rejectReason: string | null;
  incoming: boolean;
  note: string | null;
  sourceYear: string;
  sourceLevel: string;
  sourceLevelCode: string;
  sourceSection: string;
  kind: string;
  destinationYear: string;
  destinationLevel: string;
  destinationSection: string;
  toAcademicYearId: string | null;
  toSectionId: string | null;
  requestedAt: string;
  statusUpdatedAt: string;
};

function transferDate(value: string) {
  try {
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

type FormYear = {
  id: string;
  name: string;
  sections: Array<{ id: string; name: string }>;
};

export type ExternalTransferItem = {
  id: string;
  schoolId: string;
  studentId: string;
  enrollmentId: string;
  destinationSchoolName: string | null;
  reason: string | null;
  certificateNumber: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "REVERSED";
  tcDownloaded: boolean;
  transcriptDownloaded: boolean;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  reversedAt?: string | null;
  reversalReason?: string | null;
  createdAt: string;
  student: {
    id: string;
    firstName: string;
    fatherName: string;
    grandfatherName: string;
    permanentId: string;
    gender: string;
    status: string;
  };
  enrollment: {
    id: string;
    status: string;
    rollNumber: number | null;
    classGroup: { level: string };
    section: { name: string } | null;
    academicYear: { name: string };
  };
  confirmedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  reversedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

export type OrgLookupStudent = {
  id: string;
  permanentId: string;
  secondaryPermanentId: string | null;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  phone: string | null;
  nationalId: string | null;
  status: string;
  isPrimaryAlumni?: boolean;
  eligibleForReturn: boolean;
  currentEnrollment: {
    id: string;
    schoolId: string;
    schoolName: string;
    schoolCode: string;
    academicYearId: string;
    academicYearName: string;
    classGroupId: string;
    level: string;
    levelLabel: string;
    sectionId: string;
    sectionName: string;
    rollNumber: number;
    studentNumber: string;
    status: string;
    admittedOn: string;
  } | null;
  previousEnrollments: Array<{
    id: string;
    schoolId: string;
    schoolName: string;
    schoolCode: string;
    academicYearId: string;
    academicYearName: string;
    classGroupId: string;
    level: string;
    levelLabel: string;
    sectionId: string;
    sectionName: string;
    rollNumber: number;
    studentNumber: string;
    status: string;
    admittedOn: string;
    externalTransfer?: {
      id: string;
      certificateNumber: string;
      destinationSchoolName: string | null;
      reason: string | null;
      status: string;
      confirmedAt: string | null;
    } | null;
  }>;
};

export type ActiveTab = "section_move" | "internal_transfer" | "external_transfer" | "directory" | "return_reenroll";
export type DirectoryFilter = "ALL" | "PENDING" | "CONFIRMED" | "CANCELLED" | "REVERSED";
type RequestFilter = "ALL" | "INCOMING" | "OUTGOING" | "COMPLETED" | "REJECTED";

export function TransfersPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("section_move");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [placement, setPlacement] = useState<Placement[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [requestFilter, setRequestFilter] = useState<RequestFilter>("ALL");
  const [sourceYearId, setSourceYearId] = useState("");
  const [sourceSectionId, setSourceSectionId] = useState("");
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<string[]>([]);
  const [toSchoolId, setToSchoolId] = useState("");
  const [destSectionId, setDestSectionId] = useState("");
  const [sectionReviewIds, setSectionReviewIds] = useState<string[] | null>(null);
  const [schoolReviewIds, setSchoolReviewIds] = useState<string[] | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [transferReason, setTransferReason] = useState("");
  const [placementChoices, setPlacementChoices] = useState<Record<string, string>>({});
  const [formYears, setFormYears] = useState<FormYear[]>([]);
  const [formYearId, setFormYearId] = useState("");
  const [formSectionId, setFormSectionId] = useState("");
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // External Transfer Workflow state (Phase 4)
  const [extSelectedStudent, setExtSelectedStudent] = useState<StudentRow | null>(null);
  const [extDraft, setExtDraft] = useState<ExternalTransferItem | null>(null);
  const [extDestinationSchool, setExtDestinationSchool] = useState("");
  const [extReason, setExtReason] = useState("");
  const [extReviewedAck, setExtReviewedAck] = useState(false);
  const [extLoadingDraft, setExtLoadingDraft] = useState(false);
  const [extActionBusy, setExtActionBusy] = useState(false);
  const [extDownloadingDoc, setExtDownloadingDoc] = useState<"tc" | "transcript" | null>(null);
  const [extShowConfirmModal, setExtShowConfirmModal] = useState(false);

  // Transferred Students Directory state (Phase 4)
  const [dirItems, setDirItems] = useState<ExternalTransferItem[]>([]);
  const [dirFilter, setDirFilter] = useState<DirectoryFilter>("ALL");
  const [dirSearch, setDirSearch] = useState("");
  const [dirPage, setDirPage] = useState(1);
  const [dirTotalPages, setDirTotalPages] = useState(1);
  const [dirTotalCount, setDirTotalCount] = useState(0);
  const [dirLoading, setDirLoading] = useState(false);
  const [dirDetailItem, setDirDetailItem] = useState<ExternalTransferItem | null>(null);
  const [reversalReasonInput, setReversalReasonInput] = useState("");
  const [reversalBusy, setReversalBusy] = useState(false);

  // Return & Re-enrollment state
  const [returnSearch, setReturnSearch] = useState("");
  const [returnOnlyEligible, setReturnOnlyEligible] = useState(true);
  const [returnStudents, setReturnStudents] = useState<OrgLookupStudent[]>([]);
  const [returnLoading, setReturnLoading] = useState(false);
  const [selectedReturnStudent, setSelectedReturnStudent] = useState<OrgLookupStudent | null>(null);
  const [returnDestSchoolId, setReturnDestSchoolId] = useState("SELF");
  const [returnDestPlacement, setReturnDestPlacement] = useState<Placement[]>([]);
  const [returnYearId, setReturnYearId] = useState("");
  const [returnClassId, setReturnClassId] = useState("");
  const [returnSectionId, setReturnSectionId] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnBusy, setReturnBusy] = useState(false);
  const [returnExternalMarks, setReturnExternalMarks] = useState<
    Array<{
      subject: string;
      marksObtained: number | string;
      maxMarks: number | string;
      originSchool: string;
      examYear: string;
      gradeOrClass: string;
      isVerified: boolean;
      notes: string;
    }>
  >([]);

  function handleReturnFromDirectory(item: ExternalTransferItem) {
    setActiveTab("return_reenroll");
    setReturnSearch(item.student.permanentId);
    setReturnOnlyEligible(false);
    setReturnLoading(true);
    const params = new URLSearchParams({ q: item.student.permanentId });
    api<{ items: OrgLookupStudent[] }>(`/api/v1/transfers/lookup-students?${params.toString()}`)
      .then((res) => {
        setReturnStudents(res.items);
        const match = res.items.find((s) => s.id === item.student.id || s.permanentId === item.student.permanentId);
        if (match) {
          setSelectedReturnStudent(match);
          if (placement.length > 0) {
            const defYear = placement.find((y) => y.isCurrent) ?? placement[0];
            if (defYear) {
              setReturnYearId(defYear.id);
              if (defYear.classes[0]) {
                setReturnClassId(defYear.classes[0].id);
                setReturnSectionId(defYear.classes[0].sections[0]?.id ?? "");
              }
            }
          }
        }
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Could not find student record.");
      })
      .finally(() => {
        setReturnLoading(false);
      });
  }

  async function load() {
    setRefreshing(true);
    try {
      const [years, orgSchools, requests, formSchools] = await Promise.all([
        api<{
          years: Array<{
            id: string;
            name: string;
            isCurrent: boolean;
            classes: Array<{ id: string; level: string; sections: Array<{ id: string; name: string }> }>;
          }>;
        }>("/api/v1/academic-years"),
        api<School[]>("/api/v1/org-schools"),
        api<Transfer[]>("/api/v1/transfer-requests"),
        api<Array<{ sameSchool: boolean; years: FormYear[] }>>("/api/v1/alumni-form-1-options").catch(() => []),
      ]);
      setTransfers(requests);
      const mine = formSchools.find((school) => school.sameSchool);
      setFormYears(mine?.years ?? []);
      setFormYearId((current) => current || mine?.years[0]?.id || "");
      setSchools(orgSchools);

      const normalized = years.years.map((year) => ({
        id: year.id,
        name: year.name,
        isCurrent: year.isCurrent,
        classes: year.classes.map((item) => ({
          id: item.id,
          level: item.level,
          label: item.level.replace("CLASS_", "Class ").replace("FORM_", "Form "),
          sections: item.sections,
        })),
      }));
      setPlacement(normalized);

      const defaultYear = normalized.find((year) => year.isCurrent) ?? normalized[0];
      setSourceYearId((current) => current || defaultYear?.id || "");
      setSourceSectionId((current) => current || defaultYear?.classes[0]?.sections[0]?.id || "");
      setToSchoolId((current) => current || orgSchools[0]?.id || "");
    } finally {
      setRefreshing(false);
    }
  }

  async function loadDirectory(page = 1, filter = dirFilter, search = dirSearch) {
    setDirLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: "15",
        ...(filter !== "ALL" ? { status: filter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });

      const res = await api<{
        items: ExternalTransferItem[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      }>(`/api/v1/transfers/external?${queryParams.toString()}`);

      setDirItems(res.items);
      setDirPage(res.pagination.page);
      setDirTotalPages(res.pagination.totalPages || 1);
      setDirTotalCount(res.pagination.total);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load directory.");
    } finally {
      setDirLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "directory") {
      loadDirectory(1, dirFilter, dirSearch);
    } else if (activeTab === "return_reenroll") {
      void loadReturnStudents(returnSearch, returnOnlyEligible);
      if (placement.length === 0) {
        void load();
      }
    }
  }, [activeTab, dirFilter]);

  async function loadReturnStudents(search = returnSearch, onlyEligible = returnOnlyEligible) {
    setReturnLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (onlyEligible) params.set("status", "ELIGIBLE_FOR_RETURN");
      const res = await api<{ items: OrgLookupStudent[] }>(`/api/v1/transfers/lookup-students?${params.toString()}`);
      setReturnStudents(res.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to search organization students.");
    } finally {
      setReturnLoading(false);
    }
  }

  useEffect(() => {
    if (returnDestSchoolId === "SELF" || !returnDestSchoolId) {
      setReturnDestPlacement(placement);
      if (placement.length > 0) {
        const defYear = placement.find((y) => y.id === returnYearId) ?? placement.find((y) => y.isCurrent) ?? placement[0];
        if (defYear) {
          setReturnYearId(defYear.id);
          const defCls = defYear.classes.find((c) => c.id === returnClassId) ?? defYear.classes[0];
          if (defCls) {
            setReturnClassId(defCls.id);
            const defSec = defCls.sections.find((s) => s.id === returnSectionId) ?? defCls.sections[0];
            setReturnSectionId(defSec?.id ?? "");
          }
        }
      }
      return;
    }
    api<{ years: Placement[] }>(`/api/v1/transfers/school-placement/${returnDestSchoolId}`)
      .then((res) => {
        setReturnDestPlacement(res.years);
        if (res.years.length > 0) {
          const defYear = res.years.find((y) => y.id === returnYearId) ?? res.years.find((y) => y.isCurrent) ?? res.years[0];
          if (defYear) {
            setReturnYearId(defYear.id);
            const defCls = defYear.classes.find((c) => c.id === returnClassId) ?? defYear.classes[0];
            if (defCls) {
              setReturnClassId(defCls.id);
              const defSec = defCls.sections.find((s) => s.id === returnSectionId) ?? defCls.sections[0];
              setReturnSectionId(defSec?.id ?? "");
            }
          }
        }
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Could not load destination school classes.");
      });
  }, [returnDestSchoolId, placement]);

  async function handleSubmitReenrollment() {
    if (!selectedReturnStudent) return;
    if (!returnYearId || !returnSectionId || returnReason.trim().length < 3) {
      setError("Please select the destination academic year, class, section, and provide a reason for return.");
      return;
    }
    setReturnBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await api<{
        status: "COMPLETED" | "PENDING";
        studentStatus: string;
        enrollment: { id: string } | null;
      }>("/api/v1/transfers/reenroll", {
        method: "POST",
        body: JSON.stringify({
          studentId: selectedReturnStudent.id,
          ...(returnDestSchoolId !== "SELF" ? { destinationSchoolId: returnDestSchoolId } : {}),
          academicYearId: returnYearId,
          ...(returnClassId ? { classGroupId: returnClassId } : {}),
          sectionId: returnSectionId,
          reason: returnReason.trim(),
          externalExamMarks: returnExternalMarks
            .filter((m) => m.subject.trim() && m.marksObtained !== "")
            .map((m) => ({
              subject: m.subject.trim(),
              marksObtained: Number(m.marksObtained),
              maxMarks: Number(m.maxMarks) || 100,
              originSchool: m.originSchool.trim() || undefined,
              examYear: m.examYear.trim() || undefined,
              gradeOrClass: m.gradeOrClass.trim() || undefined,
              isVerified: Boolean(m.isVerified),
              notes: m.notes.trim() || undefined,
            })),
        }),
      });
      setMessage(
        res.status === "COMPLETED"
          ? `Re-enrollment approved and completed for ${selectedReturnStudent.fullName} (${selectedReturnStudent.permanentId}). A new active enrollment has been created while preserving all historical records.`
          : `Return request initiated for ${selectedReturnStudent.fullName} (${selectedReturnStudent.permanentId}). Awaiting destination school approval.`,
      );
      setSelectedReturnStudent(null);
      setReturnReason("");
      setReturnExternalMarks([]);
      await loadReturnStudents(returnSearch, returnOnlyEligible);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to complete student re-enrollment.");
    } finally {
      setReturnBusy(false);
    }
  }

  async function handleReverseErroneousTransfer() {
    if (!dirDetailItem) return;
    if (reversalReasonInput.trim().length < 3) {
      setError("Please enter a reason explaining why this transfer was erroneous (at least 3 characters).");
      return;
    }
    setReversalBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await api<{ message: string; transfer: ExternalTransferItem }>(
        `/api/v1/transfers/external/${dirDetailItem.enrollmentId}/reverse`,
        {
          method: "POST",
          body: JSON.stringify({ reason: reversalReasonInput.trim() }),
        },
      );
      setMessage(res.message);
      setDirDetailItem(res.transfer);
      setReversalReasonInput("");
      await loadDirectory(dirPage, dirFilter, dirSearch);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reverse the transfer.");
    } finally {
      setReversalBusy(false);
    }
  }

  async function selectStudentForExternal(student: StudentRow) {
    setExtSelectedStudent(student);
    setExtReviewedAck(false);
    setExtLoadingDraft(true);
    setError("");
    setMessage("");

    try {
      const draft = await api<ExternalTransferItem>(`/api/v1/transfers/external/${student.enrollmentId}`).catch(() => null);
      if (draft) {
        setExtDraft(draft);
        setExtDestinationSchool(draft.destinationSchoolName || "");
        setExtReason(draft.reason || "");
      } else {
        setExtDraft(null);
        setExtDestinationSchool("");
        setExtReason("");
      }
    } catch {
      setExtDraft(null);
    } finally {
      setExtLoadingDraft(false);
    }
  }

  async function handleCreateOrUpdateDraft() {
    if (!extSelectedStudent) return;
    setExtActionBusy(true);
    setError("");
    setMessage("");

    try {
      const res = await api<ExternalTransferItem>("/api/v1/transfers/external/draft", {
        method: "POST",
        body: JSON.stringify({
          enrollmentId: extSelectedStudent.enrollmentId,
          destinationSchoolName: extDestinationSchool.trim() || undefined,
          reason: extReason.trim() || undefined,
        }),
      });

      setExtDraft(res);
      setMessage(
        res.status === "PENDING"
          ? `External transfer draft active (Cert #${res.certificateNumber}). You can now generate and download the documents.`
          : `External transfer draft updated.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save transfer draft.");
    } finally {
      setExtActionBusy(false);
    }
  }

  async function handleCancelDraft() {
    if (!extSelectedStudent || !extDraft) return;
    const confirmCancel = window.confirm("Are you sure you want to cancel this pending external transfer draft?");
    if (!confirmCancel) return;

    setExtActionBusy(true);
    setError("");
    setMessage("");

    try {
      const cancelled = await api<ExternalTransferItem>(`/api/v1/transfers/external/${extSelectedStudent.enrollmentId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "Draft cancelled by administrator" }),
      });
      setExtDraft(cancelled);
      setMessage("External transfer draft has been cancelled. The student remains actively enrolled.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to cancel transfer draft.");
    } finally {
      setExtActionBusy(false);
    }
  }

  async function handleDownloadDoc(type: "tc" | "transcript") {
    if (!extSelectedStudent || !extDraft) return;
    setExtDownloadingDoc(type);
    setError("");

    try {
      const { blob, filename } = await apiBlob(`/api/v1/transfers/external/${extSelectedStudent.enrollmentId}/documents/${type}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Refresh draft to update download indicator flags
      const refreshed = await api<ExternalTransferItem>(`/api/v1/transfers/external/${extSelectedStudent.enrollmentId}`);
      setExtDraft(refreshed);
      setMessage(`Downloaded ${type === "tc" ? "Transfer Certificate" : "Academic Transcript"} successfully.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Failed to download ${type}.`);
    } finally {
      setExtDownloadingDoc(null);
    }
  }

  async function handleConfirmExternalTransfer() {
    if (!extSelectedStudent || !extDraft) return;
    if (!extReviewedAck) {
      setError("Please check the acknowledgement confirming both documents were prepared and reviewed.");
      return;
    }

    setExtActionBusy(true);
    setError("");
    setMessage("");

    try {
      const res = await api<{ transfer: ExternalTransferItem; alreadyConfirmed: boolean }>(
        `/api/v1/transfers/external/${extSelectedStudent.enrollmentId}/confirm`,
        {
          method: "POST",
          body: JSON.stringify({ documentsReviewed: true }),
        },
      );

      setExtDraft(res.transfer);
      setExtShowConfirmModal(false);
      setMessage(
        `External transfer confirmed successfully (Cert #${res.transfer.certificateNumber}). Student has been withdrawn and enrollment marked transferred.`,
      );

      // Refresh students list in current section to remove withdrawn student
      if (sourceYearId && sourceSectionId) {
        api<{ students: StudentRow[] }>(
          `/api/v1/students?academicYearId=${sourceYearId}&sectionId=${sourceSectionId}&status=ACTIVE`,
        )
          .then((resp) => {
            setStudents(resp.students);
            if (extSelectedStudent) {
              setExtSelectedStudent(null);
            }
          })
          .catch(() => { });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to confirm external transfer.");
    } finally {
      setExtActionBusy(false);
    }
  }

  useEffect(() => {
    load().catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : "Could not load transfers data."),
    );
  }, []);

  useEffect(() => {
    if (!sourceYearId || !sourceSectionId) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    api<{ students: StudentRow[] }>(
      `/api/v1/students?academicYearId=${sourceYearId}&sectionId=${sourceSectionId}&status=ACTIVE`,
    )
      .then((response) => {
        setStudents(response.students);
        setSelectedEnrollmentIds([]);
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Could not load students."),
      )
      .finally(() => setLoadingStudents(false));
  }, [sourceYearId, sourceSectionId]);

  const sourceYear = placement.find((year) => year.id === sourceYearId);
  const sourceSections =
    sourceYear?.classes.flatMap((item) =>
      item.sections.map((section) => ({
        ...section,
        label: `${item.label} · Section ${section.name}`,
      })),
    ) ?? [];
  const sourceClass = sourceYear?.classes.find((item) =>
    item.sections.some((section) => section.id === sourceSectionId),
  );
  const fromLabel =
    sourceSections.find((section) => section.id === sourceSectionId)?.label ?? "";
  const insideSections = (sourceClass?.sections ?? []).filter(
    (section) => section.id !== sourceSectionId,
  );
  const destinationSection = sourceClass?.sections.find(
    (section) => section.id === destSectionId,
  );
  const compatibleSchools = schools.filter((school) =>
    sourceClass?.level.startsWith("CLASS_")
      ? school.type !== "SECONDARY_ONLY"
      : sourceClass?.level.startsWith("FORM_")
        ? school.type !== "PRIMARY_ONLY"
        : false,
  );

  useEffect(() => {
    setToSchoolId((current) =>
      compatibleSchools.some((school) => school.id === current)
        ? current
        : compatibleSchools[0]?.id ?? "",
    );
  }, [sourceClass?.level, schools]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.permanentId.toLowerCase().includes(q) ||
        String(s.rollNumber ?? "").includes(q),
    );
  }, [students, studentSearch]);

  const allSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((student) =>
      selectedEnrollmentIds.includes(student.enrollmentId),
    );

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedEnrollmentIds([]);
    } else {
      setSelectedEnrollmentIds(filteredStudents.map((s) => s.enrollmentId));
    }
  }

  function toggleStudent(enrollmentId: string) {
    setSelectedEnrollmentIds((prev) =>
      prev.includes(enrollmentId)
        ? prev.filter((id) => id !== enrollmentId)
        : [...prev, enrollmentId],
    );
  }

  async function requestTransfer(enrollmentIds: string[]) {
    setError("");
    setMessage("");
    if (!enrollmentIds.length) {
      setError("Please select at least one student to transfer.");
      return;
    }
    try {
      await api("/api/v1/transfer-requests", {
        method: "POST",
        body: JSON.stringify({
          enrollmentIds,
          toSchoolId,
          note: transferReason,
        }),
      });
      setMessage(
        enrollmentIds.length === students.length
          ? `Entire section transfer sent (${enrollmentIds.length} students). The destination school will review and place them.`
          : enrollmentIds.length === 1
            ? "Transfer request sent. Awaiting destination school review."
            : `${enrollmentIds.length} student transfer requests sent successfully.`,
      );
      setSelectedEnrollmentIds([]);
      setTransferReason("");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not request the transfer.",
      );
    }
  }

  function matchingSections(row: Transfer) {
    if (row.kind === "RETURN") {
      return placement.flatMap((year) =>
        year.classes.flatMap((item) =>
          item.sections.map((section) => ({
            id: section.id,
            yearId: year.id,
            label: `${year.name} · ${item.label} · Section ${section.name}`,
          })),
        ),
      );
    }
    return placement.flatMap((year) =>
      year.name !== row.sourceYear
        ? []
        : year.classes.flatMap((item) =>
          item.level !== row.sourceLevelCode
            ? []
            : item.sections.map((section) => ({
              id: section.id,
              yearId: year.id,
              label: `${year.name} · ${item.label} · Section ${section.name}`,
            })),
        ),
    );
  }

  async function decide(row: Transfer, action: "approve" | "reject") {
    setError("");
    try {
      const sectionId = placementChoices[row.id];
      const option = matchingSections(row).find((item) => item.id === sectionId);
      const formSection = formYears
        .find((year) => year.id === formYearId)
        ?.sections.find((section) => section.id === formSectionId);
      if (action === "approve" && row.kind === "FORM_1" && !formSection) {
        setError("Please choose a Form 1 destination section before accepting.");
        return;
      }
      const reason =
        action === "reject"
          ? window.prompt("Reason for rejection (optional):") ?? ""
          : "";
      await api(`/api/v1/transfer-requests/${row.id}/${action}`, {
        method: "POST",
        body: JSON.stringify(
          action === "reject"
            ? { reason }
            : row.kind === "FORM_1"
              ? { toAcademicYearId: formYearId, toSectionId: formSectionId }
              : option
                ? { toAcademicYearId: option.yearId, toSectionId: option.id }
                : {},
        ),
      });
      setMessage(
        action === "reject"
          ? "Transfer request was rejected."
          : row.kind === "FORM_1"
            ? `Student admitted into section ${formSection?.name}.`
            : option
              ? "Student transfer accepted and placed into the section."
              : "Student accepted. Waiting for section placement.",
      );
      setSelectedRequestIds((current) => current.filter((id) => id !== row.id));
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update the transfer request.",
      );
    }
  }

  async function acceptSelected(rows: Transfer[]) {
    const formSection = formYears
      .find((year) => year.id === formYearId)
      ?.sections.find((section) => section.id === formSectionId);
    if (!formSection) {
      setError("Please choose a Form 1 destination section first.");
      return;
    }
    setError("");
    try {
      for (const row of rows) {
        await api(`/api/v1/transfer-requests/${row.id}/approve`, {
          method: "POST",
          body: JSON.stringify({
            toAcademicYearId: formYearId,
            toSectionId: formSectionId,
          }),
        });
      }
      setMessage(
        `Successfully placed ${rows.length} students into Section ${formSection.name}.`,
      );
      setSelectedRequestIds([]);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not accept the selected students.",
      );
      await load();
    }
  }

  const incomingForm1 = transfers.filter(
    (row) =>
      row.incoming &&
      row.kind === "FORM_1" &&
      ["PENDING", "WAITING_FOR_SECTION"].includes(row.status),
  );
  const formSections =
    formYears.find((year) => year.id === formYearId)?.sections ?? [];
  const chosenIncoming = incomingForm1.filter((row) =>
    selectedRequestIds.includes(row.id),
  );

  const pendingIncomingCount = transfers.filter(
    (t) => t.incoming && ["PENDING", "WAITING_FOR_SECTION"].includes(t.status),
  ).length;
  const pendingOutgoingCount = transfers.filter(
    (t) => !t.incoming && t.status === "PENDING",
  ).length;

  const filteredTransfers = useMemo(() => {
    switch (requestFilter) {
      case "INCOMING":
        return transfers.filter((t) => t.incoming);
      case "OUTGOING":
        return transfers.filter((t) => !t.incoming);
      case "COMPLETED":
        return transfers.filter((t) => t.status === "COMPLETED");
      case "REJECTED":
        return transfers.filter((t) => t.status === "REJECTED");
      default:
        return transfers;
    }
  }, [transfers, requestFilter]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. HERO HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 p-6 text-white shadow-xl sm:p-8">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-300">
              <span>Students</span>
              <span>›</span>
              <span className="text-white">Transfers Hub</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-white flex items-center gap-3">
              <ArrowLeftRight className="h-8 w-8 text-blue-400" />
              Student Transfers & Section Moves
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              Move students seamlessly between sections within your school, or transfer students to other partner schools with full academic continuity.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => load()}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95 border border-white/10"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* METRIC CHIPS */}
        <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-white/5 p-3.5 backdrop-blur-md border border-white/10">
            <span className="text-xs font-medium text-slate-400">Class Enrolled</span>
            <p className="mt-1 text-2xl font-black text-white">{students.length}</p>
            <span className="text-[11px] text-blue-300">{sourceClass?.label ?? "Active section"}</span>
          </div>

          <div className="rounded-2xl bg-white/5 p-3.5 backdrop-blur-md border border-white/10">
            <span className="text-xs font-medium text-slate-400">Selected</span>
            <p className="mt-1 text-2xl font-black text-blue-400">{selectedEnrollmentIds.length}</p>
            <span className="text-[11px] text-slate-300">Ready for action</span>
          </div>

          <div className="rounded-2xl bg-white/5 p-3.5 backdrop-blur-md border border-white/10">
            <span className="text-xs font-medium text-slate-400">Incoming Requests</span>
            <p className="mt-1 text-2xl font-black text-amber-300">{pendingIncomingCount}</p>
            <span className="text-[11px] text-amber-200">Awaiting your review</span>
          </div>

          <div className="rounded-2xl bg-white/5 p-3.5 backdrop-blur-md border border-white/10">
            <span className="text-xs font-medium text-slate-400">Outgoing Pending</span>
            <p className="mt-1 text-2xl font-black text-indigo-300">{pendingOutgoingCount}</p>
            <span className="text-[11px] text-slate-300">Awaiting acceptance</span>
          </div>
        </div>
      </div>

      {/* FEEDBACK MESSAGES */}
      {message ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{message}</span>
          <button onClick={() => setMessage("")} className="ml-auto text-emerald-600 hover:text-emerald-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 shadow-sm animate-in fade-in">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-auto text-rose-600 hover:text-rose-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* 2. NAVIGATION TABS (4 TABS) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("section_move")}
          className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold transition-all ${activeTab === "section_move"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
            }`}
        >
          <UsersRound className="h-4 w-4" />
          1. Section Move
        </button>

        <button
          onClick={() => setActiveTab("internal_transfer")}
          className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold transition-all ${activeTab === "internal_transfer"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
            }`}
        >
          <Building2 className="h-4 w-4" />
          2. Internal Transfer
          {pendingIncomingCount > 0 ? (
            <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-white">
              {pendingIncomingCount}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab("external_transfer")}
          className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold transition-all ${activeTab === "external_transfer"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
            }`}
        >
          <Send className="h-4 w-4" />
          3. External Transfer
        </button>

        <button
          onClick={() => setActiveTab("directory")}
          className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold transition-all ${activeTab === "directory"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
            }`}
        >
          <History className="h-4 w-4" />
          4. Transfer History & Directory
        </button>

        <button
          onClick={() => setActiveTab("return_reenroll")}
          className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold transition-all ${activeTab === "return_reenroll"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
            }`}
        >
          <UserCheck className="h-4 w-4" />
          5. Return & Re-enroll Student
        </button>
      </div>

      {/* TAB 1: SECTION MOVE & TAB 2: INTERNAL TRANSFER */}
      {(activeTab === "section_move" || activeTab === "internal_transfer") && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* LEFT COLUMN: STUDENT PICKER (8 Cols) */}
          <div className="space-y-4 lg:col-span-8">
            {/* SOURCE CLASS & YEAR FILTER CARD */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Filter className="h-3.5 w-3.5 text-blue-600" />
                Step 1: Choose Source Section
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold text-slate-700">Academic Year</span>
                  <div className="relative mt-1">
                    <select
                      className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-800 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100"
                      value={sourceYearId}
                      onChange={(event) => {
                        const next = placement.find((year) => year.id === event.target.value);
                        setSourceYearId(event.target.value);
                        setSourceSectionId(next?.classes[0]?.sections[0]?.id ?? "");
                        setDestSectionId("");
                      }}
                    >
                      {placement.map((year) => (
                        <option key={year.id} value={year.id}>
                          {year.name} {year.isCurrent ? "(Current Year)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-slate-700">Class & Section</span>
                  <div className="relative mt-1">
                    <select
                      className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-800 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100"
                      value={sourceSectionId}
                      onChange={(event) => {
                        setSourceSectionId(event.target.value);
                        setDestSectionId("");
                      }}
                    >
                      {sourceSections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
              </div>
            </div>

            {/* STUDENTS LIST CARD */}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2.5 select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-blue-600 transition"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                    />
                    <span className="text-xs font-bold text-slate-800">Select All in Class</span>
                  </label>

                  <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-extrabold text-blue-700">
                    {selectedEnrollmentIds.length} of {students.length} chosen
                  </span>
                </div>

                {/* SEARCH INPUT */}
                <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name or ID..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs font-semibold text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                  {studentSearch && (
                    <button
                      onClick={() => setStudentSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {loadingStudents ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <p className="mt-3 text-xs font-semibold">Loading students...</p>
                </div>
              ) : filteredStudents.length ? (
                <div className="divide-y divide-slate-100">
                  {filteredStudents.map((student) => {
                    const selected = selectedEnrollmentIds.includes(student.enrollmentId);
                    return (
                      <div
                        key={student.id}
                        onClick={() => toggleStudent(student.enrollmentId)}
                        className={`group flex cursor-pointer flex-wrap items-center gap-3 px-5 py-3.5 transition-colors ${selected
                            ? "bg-blue-50/60 hover:bg-blue-50"
                            : "hover:bg-slate-50/80"
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => { }} // handled by row click
                          className="h-4 w-4 rounded accent-blue-600"
                        />

                        {/* AVATAR */}
                        <div className="shrink-0">
                          {student.photoUrl ? (
                            <img
                              src={student.photoUrl}
                              alt=""
                              className="h-10 w-10 rounded-2xl object-cover ring-2 ring-white shadow-sm"
                            />
                          ) : (
                            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white shadow-sm">
                              {student.name
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((part) => part[0])
                                .join("")}
                            </span>
                          )}
                        </div>

                        {/* NAME & IDS */}
                        <div className="min-w-[180px] flex-1">
                          <Link
                            to={`/school/students/${student.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-slate-900 group-hover:text-blue-600 hover:underline"
                          >
                            {student.name}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[11px] font-semibold text-slate-500">
                              {student.permanentId}
                            </span>
                            <span className="text-[11px] font-medium text-slate-400">
                              · Current: {student.level} Sec {student.section}
                            </span>
                          </div>
                        </div>

                        {/* BADGES */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-slate-600">
                            {student.gender === "MALE" ? "Male" : "Female"}
                          </span>
                          <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-indigo-700 border border-indigo-100 font-bold">
                            Roll #{student.rollNumber ?? "—"}
                          </span>
                          <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-emerald-700 border border-emerald-100">
                            {student.status}
                          </span>
                        </div>

                        {selected && (
                          <div className="grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-white">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400">
                  <p className="text-sm font-semibold">
                    {sourceClass?.level === "CLASS_8" || sourceClass?.level === "FORM_4"
                      ? "No active students in this section. Graduates are transferred from Alumni."
                      : "No active students found in this section."}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: ACTION PANEL (4 Cols) */}
          <div className="space-y-4 lg:col-span-4">
            {activeTab === "section_move" ? (
              /* SECTION MOVE ACTION CARD */
              <div className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                    <UsersRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900">Step 2: Destination Section</h3>
                    <p className="text-xs text-slate-500">Move inside {sourceClass?.label ?? "same class"}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Transferring From:
                    </span>
                    <p className="mt-1 text-sm font-bold text-slate-800">
                      {fromLabel || "No section chosen"}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Target Section (Same Class)
                    </label>
                    <select
                      className="mt-1.5 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                      value={destSectionId}
                      onChange={(e) => setDestSectionId(e.target.value)}
                    >
                      <option value="">Select Target Section...</option>
                      {insideSections.map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          {sourceClass?.label} · Section {sec.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!insideSections.length && (
                    <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 border border-amber-200">
                      This class does not have another section. Please create Section B/C first under Academic Years.
                    </p>
                  )}
                </div>

                <div className="mt-6 border-t border-slate-100 pt-5 space-y-2">
                  <button
                    type="button"
                    disabled={!selectedEnrollmentIds.length || !destSectionId}
                    onClick={() => setSectionReviewIds(selectedEnrollmentIds)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Move {selectedEnrollmentIds.length || 0} Selected Student{selectedEnrollmentIds.length === 1 ? "" : "s"}
                    <MoveRight className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    disabled={!students.length || !destSectionId}
                    onClick={() => setSectionReviewIds(students.map((s) => s.enrollmentId))}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Move Entire Section ({students.length})
                  </button>
                </div>
              </div>
            ) : (
              /* EXTERNAL SCHOOL TRANSFER ACTION CARD */
              <div className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900">Step 2: Choose Destination School</h3>
                    <p className="text-xs text-slate-500">Partner School in Organization</p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Partner School
                    </label>
                    <select
                      className="mt-1.5 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                      value={toSchoolId}
                      onChange={(e) => setToSchoolId(e.target.value)}
                    >
                      {compatibleSchools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Reason for Transfer *
                    </label>
                    <textarea
                      rows={3}
                      value={transferReason}
                      onChange={(e) => setTransferReason(e.target.value)}
                      maxLength={500}
                      placeholder="e.g. Student relocated to another district, requested by parent..."
                      className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100"
                    />
                    <div className="text-right text-[11px] font-mono text-slate-400">
                      {transferReason.length}/500
                    </div>
                  </div>

                  <div className="rounded-2xl bg-indigo-50/70 p-3.5 text-xs text-indigo-900 border border-indigo-100 leading-relaxed">
                    <strong>Note:</strong> The student records and past terms remain preserved here. The receiving school will review and assign them to a matching section.
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-100 pt-5 space-y-2">
                  <button
                    type="button"
                    disabled={
                      !selectedEnrollmentIds.length ||
                      !toSchoolId ||
                      transferReason.trim().length < 3
                    }
                    onClick={() => setSchoolReviewIds(selectedEnrollmentIds)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Transfer {selectedEnrollmentIds.length || 0} Selected
                    <Send className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    disabled={
                      !students.length ||
                      !toSchoolId ||
                      transferReason.trim().length < 3
                    }
                    onClick={() => setSchoolReviewIds(students.map((s) => s.enrollmentId))}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Transfer Entire Section ({students.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2 SUB-SECTION: INTERNAL TRANSFER REQUESTS & STATUS */}
      {activeTab === "internal_transfer" && (
        <div className="space-y-6 pt-6 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Partner School Transfer Requests</h2>
              <p className="text-xs text-slate-500">Track and review student movement between organization schools</p>
            </div>
          </div>
          {/* INCOMING GRADUATES (CLASS 8 -> FORM 1) HERO NOTICE */}
          {incomingForm1.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-white shadow-md">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-indigo-950">
                    Incoming Primary Graduates (Class 8 → Form 1)
                  </h3>
                  <p className="mt-1 text-xs text-indigo-800">
                    You have {incomingForm1.length} student{incomingForm1.length === 1 ? "" : "s"} waiting for Form 1 section admission. Choose your Form 1 academic year and section below:
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Form 1 Academic Year
                      <select
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-800"
                        value={formYearId}
                        onChange={(e) => {
                          setFormYearId(e.target.value);
                          setFormSectionId("");
                        }}
                      >
                        {formYears.map((y) => (
                          <option key={y.id} value={y.id}>
                            {y.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-xs font-bold text-slate-700">
                      Target Section
                      <select
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-800"
                        value={formSectionId}
                        onChange={(e) => setFormSectionId(e.target.value)}
                      >
                        <option value="">Choose Form 1 Section...</option>
                        {formSections.map((s) => (
                          <option key={s.id} value={s.id}>
                            Section {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedRequestIds(
                          chosenIncoming.length === incomingForm1.length
                            ? []
                            : incomingForm1.map((r) => r.id),
                        )
                      }
                      className="text-xs font-bold text-indigo-700 hover:underline"
                    >
                      {chosenIncoming.length === incomingForm1.length
                        ? "Deselect All"
                        : "Select All Incoming Graduates"}
                    </button>

                    <button
                      type="button"
                      disabled={!chosenIncoming.length || !formSectionId}
                      onClick={() => void acceptSelected(chosenIncoming)}
                      className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-indigo-500 disabled:opacity-40"
                    >
                      Admit {chosenIncoming.length || 0} Student{chosenIncoming.length === 1 ? "" : "s"} into Section
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* REQUEST FILTER BUTTONS */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["ALL", "All Requests"],
                ["INCOMING", "Incoming to us"],
                ["OUTGOING", "Sent by us"],
                ["COMPLETED", "Completed"],
                ["REJECTED", "Rejected"],
              ] as const
            ).map(([code, label]) => (
              <button
                key={code}
                onClick={() => setRequestFilter(code)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${requestFilter === code
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* REQUESTS LIST */}
          <div className="space-y-3">
            {filteredTransfers.length ? (
              filteredTransfers.map((row) => (
                <div
                  key={row.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-extrabold text-slate-900">{row.name}</span>
                        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {row.permanentId}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <span className="text-slate-800">{row.fromSchool}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-slate-800">{row.toSchool}</span>
                      </div>

                      <p className="text-xs text-slate-400">
                        {row.sourceYear} · {row.sourceLevel} · Section {row.sourceSection}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                        <span>Requested: {transferDate(row.requestedAt)}</span>
                        {row.status !== "PENDING" && (
                          <span>Updated: {transferDate(row.statusUpdatedAt)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <TransferStatus status={row.status} />
                      <span className="text-[11px] font-bold text-slate-400">
                        {row.incoming ? "Incoming Request" : "Outgoing Request"}
                      </span>
                    </div>
                  </div>

                  {row.note && (
                    <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-700 border border-slate-100">
                      <strong className="text-slate-900">Reason:</strong> {row.note}
                    </div>
                  )}

                  {row.rejectReason && (
                    <div className="mt-2 rounded-2xl bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
                      <strong>Rejection note:</strong> {row.rejectReason}
                    </div>
                  )}

                  {/* INCOMING ACTION CONTROLS */}
                  {row.incoming && ["PENDING", "WAITING_FOR_SECTION"].includes(row.status) && (
                    <div className="mt-4 rounded-2xl bg-blue-50/60 p-4 border border-blue-100">
                      {row.kind === "FORM_1" ? (
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-slate-700">
                            Check student history before admitting.
                          </p>
                          <Link
                            className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-blue-700 border border-blue-200 shadow-sm hover:bg-blue-50"
                            to={`/school/alumni/${row.studentId}`}
                          >
                            Review Student Academic File
                          </Link>
                        </div>
                      ) : matchingSections(row).length ? (
                        <div>
                          <label className="block text-xs font-bold text-slate-700">
                            Select Matching Destination Section:
                          </label>
                          <select
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-800"
                            value={placementChoices[row.id] ?? ""}
                            onChange={(e) =>
                              setPlacementChoices({ ...placementChoices, [row.id]: e.target.value })
                            }
                          >
                            <option value="">Select Section...</option>
                            {matchingSections(row).map((sec) => (
                              <option key={sec.id} value={sec.id}>
                                {sec.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <p className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                          <Clock3 className="h-4 w-4" />
                          No matching section currently exists for this level in your school.
                        </p>
                      )}

                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => decide(row, "approve")}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-500"
                        >
                          {row.kind === "FORM_1"
                            ? "Accept into Section"
                            : placementChoices[row.id]
                              ? "Accept & Place into Section"
                              : "Accept · Wait for Section"}
                        </button>

                        {row.status === "PENDING" && (
                          <button
                            onClick={() => decide(row, "reject")}
                            className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                          >
                            Reject Request
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-400">
                <ArrowLeftRight className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm font-semibold">No transfer requests in this category.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: EXTERNAL TRANSFER WORKFLOW (PHASE 4) */}
      {activeTab === "external_transfer" && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* LEFT: STUDENT SELECTION & SEARCH (5 COLS) */}
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Search className="h-3.5 w-3.5 text-blue-600" />
                Step 1: Select Active Student
              </div>

              {/* SECTION FILTER */}
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-bold text-slate-600">Year</span>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-800"
                    value={sourceYearId}
                    onChange={(e) => {
                      const next = placement.find((y) => y.id === e.target.value);
                      setSourceYearId(e.target.value);
                      setSourceSectionId(next?.classes[0]?.sections[0]?.id ?? "");
                    }}
                  >
                    {placement.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[11px] font-bold text-slate-600">Class & Section</span>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-800"
                    value={sourceSectionId}
                    onChange={(e) => setSourceSectionId(e.target.value)}
                  >
                    {sourceSections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* SEARCH INPUT */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Filter student by name or ID..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* STUDENT LIST */}
              <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                {loadingStudents ? (
                  <div className="py-8 text-center text-xs text-slate-400">Loading students...</div>
                ) : filteredStudents.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">No active students in this section.</div>
                ) : (
                  filteredStudents.map((stu) => {
                    const isSelected = extSelectedStudent?.enrollmentId === stu.enrollmentId;
                    return (
                      <div
                        key={stu.enrollmentId}
                        onClick={() => void selectStudentForExternal(stu)}
                        className={`p-3 rounded-2xl border cursor-pointer transition ${isSelected
                            ? "bg-blue-50 border-blue-400 shadow-sm ring-1 ring-blue-400"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900">{stu.name}</span>
                          <span className="font-mono text-[11px] text-slate-500">{stu.permanentId}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                          <span>Roll #{stu.rollNumber ?? "—"}</span>
                          <span>·</span>
                          <span>{stu.gender === "MALE" ? "Male" : "Female"}</span>
                          <span>·</span>
                          <span className="text-emerald-600 font-semibold">{stu.status}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: DRAFT CREATION, DOCUMENT DOWNLOADS & CONFIRMATION (7 COLS) */}
          <div className="space-y-4 lg:col-span-7">
            {!extSelectedStudent ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
                <Send className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-600">Select an Active Student to Begin</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Choose a student from the list on the left to prepare an official Transfer Certificate and Academic Transcript for transfer outside the organization.
                </p>
              </div>
            ) : extLoadingDraft ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-400">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600 mb-2" />
                <p className="text-xs font-semibold">Loading transfer draft details...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* STUDENT SUMMARY HEADER CARD */}
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Selected Candidate</span>
                      <h3 className="text-lg font-black text-slate-900 mt-0.5">{extSelectedStudent.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <span className="font-mono font-semibold">{extSelectedStudent.permanentId}</span>
                        <span>·</span>
                        <span>{extSelectedStudent.level} (Section {extSelectedStudent.section})</span>
                        <span>·</span>
                        <span>{extSelectedStudent.year}</span>
                      </div>
                    </div>
                    {extDraft && (
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Certificate #</span>
                        <p className="font-mono font-black text-sm text-blue-600">{extDraft.certificateNumber}</p>
                        <span
                          className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${extDraft.status === "CONFIRMED"
                              ? "bg-emerald-100 text-emerald-800"
                              : extDraft.status === "CANCELLED"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                        >
                          {extDraft.status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* TRANSFER DRAFT FORM CARD */}
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <FileText className="h-3.5 w-3.5 text-blue-600" />
                    Step 2: Transfer Details (Draft)
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700">Destination School Name (Optional)</label>
                      <input
                        type="text"
                        value={extDestinationSchool}
                        onChange={(e) => setExtDestinationSchool(e.target.value)}
                        disabled={extDraft?.status === "CONFIRMED"}
                        placeholder="e.g. Al-Nour Academy, Mogadishu"
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700">Reason for Transfer (Optional)</label>
                      <input
                        type="text"
                        value={extReason}
                        onChange={(e) => setExtReason(e.target.value)}
                        disabled={extDraft?.status === "CONFIRMED"}
                        placeholder="e.g. Family relocation, parent request"
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {extDraft?.status !== "CONFIRMED" && (
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        disabled={extActionBusy}
                        onClick={() => void handleCreateOrUpdateDraft()}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
                      >
                        {extActionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        {extDraft ? "Update Draft Details" : "Create Transfer Draft"}
                      </button>

                      {extDraft && extDraft.status === "PENDING" && (
                        <button
                          type="button"
                          disabled={extActionBusy}
                          onClick={() => void handleCancelDraft()}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >
                          Cancel Draft
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* DOCUMENT PREPARATION & DOWNLOAD CARD */}
                {extDraft && extDraft.status !== "CANCELLED" && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <Download className="h-3.5 w-3.5 text-blue-600" />
                      Step 3: Generate & Download Official Documents (.DOCX)
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* TRANSFER CERTIFICATE BUTTON */}
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-extrabold text-xs text-slate-900">Transfer Certificate (TC)</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">Official leaving certificate with cert #{extDraft.certificateNumber}</p>
                          </div>
                          {extDraft.tcDownloaded ? (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                              <Check className="h-3 w-3" /> Ready
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">Pending</span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={extDownloadingDoc !== null}
                          onClick={() => void handleDownloadDoc("tc")}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 shadow-sm disabled:opacity-50"
                        >
                          {extDownloadingDoc === "tc" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                          ) : (
                            <Download className="h-3.5 w-3.5 text-blue-600" />
                          )}
                          Download TC (.docx)
                        </button>
                      </div>

                      {/* ACADEMIC TRANSCRIPT BUTTON */}
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-extrabold text-xs text-slate-900">Student Academic Transcript</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">Published exam marks & cumulative averages extract</p>
                          </div>
                          {extDraft.transcriptDownloaded ? (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                              <Check className="h-3 w-3" /> Ready
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">Pending</span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={extDownloadingDoc !== null}
                          onClick={() => void handleDownloadDoc("transcript")}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 shadow-sm disabled:opacity-50"
                        >
                          {extDownloadingDoc === "transcript" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                          ) : (
                            <Download className="h-3.5 w-3.5 text-blue-600" />
                          )}
                          Download Transcript (.docx)
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* FINAL CONFIRMATION CARD */}
                {extDraft && extDraft.status === "PENDING" && (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
                      <FileCheck className="h-3.5 w-3.5 text-amber-700" />
                      Step 4: Final Confirmation
                    </div>

                    <div className="text-xs text-amber-900 space-y-1">
                      <p>
                        <strong>Warning:</strong> Confirming this external transfer will irrevocably set the enrollment status to{" "}
                        <span className="font-bold underline">TRANSFERRED</span> and the student status to{" "}
                        <span className="font-bold underline">WITHDRAWN</span>.
                      </p>
                      <p className="text-[11px] text-amber-800">
                        Historical results, attendance, and identity remain safely preserved for historical queries.
                      </p>
                    </div>

                    <label className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-amber-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={extReviewedAck}
                        onChange={(e) => setExtReviewedAck(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-semibold text-slate-800">
                        I confirm that both the Transfer Certificate and Student Transcript have been downloaded, reviewed, and prepared for the student.
                      </span>
                    </label>

                    <button
                      type="button"
                      disabled={!extDraft.tcDownloaded || !extDraft.transcriptDownloaded || !extReviewedAck || extActionBusy}
                      onClick={() => setExtShowConfirmModal(true)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 py-3.5 text-xs font-extrabold text-white shadow-md hover:bg-amber-500 disabled:opacity-40"
                    >
                      Finalize & Confirm External Transfer
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TRANSFERRED STUDENTS DIRECTORY (PHASE 4) */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          {/* SEARCH & FILTER CONTROLS */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-blue-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">Transferred Students Directory</h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                  {dirTotalCount} records
                </span>
              </div>

              {/* STATUS FILTER BUTTONS */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ["ALL", "All"],
                    ["CONFIRMED", "Confirmed Transferred"],
                    ["PENDING", "Pending Drafts"],
                    ["CANCELLED", "Cancelled"],
                    ["REVERSED", "Reversed (Erroneous)"],
                  ] as const
                ).map(([code, label]) => (
                  <button
                    key={code}
                    onClick={() => {
                      setDirFilter(code);
                      void loadDirectory(1, code, dirSearch);
                    }}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${dirFilter === code
                        ? "bg-slate-900 text-white"
                        : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* SEARCH INPUT */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={dirSearch}
                onChange={(e) => {
                  setDirSearch(e.target.value);
                  void loadDirectory(1, dirFilter, e.target.value);
                }}
                placeholder="Search by student name, student ID, certificate number, or destination school..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* TABLE */}
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            {dirLoading ? (
              <div className="p-12 text-center text-xs text-slate-400">Loading transferred students directory...</div>
            ) : dirItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <History className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold">No transfer records found in this category.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-5 py-3.5">Student</th>
                      <th className="px-4 py-3.5">Certificate #</th>
                      <th className="px-4 py-3.5">Last Class / Section</th>
                      <th className="px-4 py-3.5">Destination School</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Confirmed Date</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {dirItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-5 py-3">
                          <div className="font-bold text-slate-900">
                            {item.student.firstName} {item.student.fatherName} {item.student.grandfatherName}
                          </div>
                          <span className="font-mono text-[11px] text-slate-500">{item.student.permanentId}</span>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-blue-600">{item.certificateNumber}</td>
                        <td className="px-4 py-3">
                          <span>{item.enrollment.classGroup.level.replace("CLASS_", "Class ").replace("FORM_", "Form ")}</span>
                          {item.enrollment.section && <span className="text-slate-500"> (Sec {item.enrollment.section.name})</span>}
                          <div className="text-[10px] text-slate-400">{item.enrollment.academicYear.name}</div>
                        </td>
                        <td className="px-4 py-3">{item.destinationSchoolName || <span className="text-slate-400 italic">Not specified</span>}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${item.status === "CONFIRMED"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.status === "CANCELLED"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {item.confirmedAt ? transferDate(item.confirmedAt) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.status === "CONFIRMED" && (
                              <button
                                type="button"
                                onClick={() => handleReturnFromDirectory(item)}
                                className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition"
                                title="Return and re-enroll this student"
                              >
                                <UserCheck className="h-3 w-3" />
                                Return Student
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDirDetailItem(item)}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* PAGINATION */}
            {dirTotalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs font-semibold text-slate-600 bg-slate-50/50">
                <span>
                  Page {dirPage} of {dirTotalPages} ({dirTotalCount} records)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={dirPage <= 1 || dirLoading}
                    onClick={() => void loadDirectory(dirPage - 1, dirFilter, dirSearch)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold hover:bg-slate-100 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={dirPage >= dirTotalPages || dirLoading}
                    onClick={() => void loadDirectory(dirPage + 1, dirFilter, dirSearch)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold hover:bg-slate-100 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: RETURN & RE-ENROLL STUDENT (ORGANIZATION-WIDE) */}
      {activeTab === "return_reenroll" && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* LEFT: SEARCH EXISTING STUDENT RECORDS IN ORGANIZATION (6 COLS) */}
          <div className="space-y-4 lg:col-span-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Search className="h-3.5 w-3.5 text-blue-600" />
                  Step 1: Find Existing Student in Organization
                </div>
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={returnOnlyEligible}
                    onChange={(e) => {
                      setReturnOnlyEligible(e.target.checked);
                      void loadReturnStudents(returnSearch, e.target.checked);
                    }}
                    className="h-3.5 w-3.5 rounded accent-blue-600"
                  />
                  Eligible for return only
                </label>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={returnSearch}
                    onChange={(e) => {
                      setReturnSearch(e.target.value);
                      void loadReturnStudents(e.target.value, returnOnlyEligible);
                    }}
                    placeholder="Search by Student ID (STU-...), full name, phone, or NIRA..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void loadReturnStudents(returnSearch, returnOnlyEligible)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Search
                </button>
              </div>

              <div className="max-h-[480px] overflow-y-auto space-y-2.5 pr-1">
                {returnLoading ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600 mb-2" />
                    Searching organization student records...
                  </div>
                ) : returnStudents.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No matching students found in your organization.
                  </div>
                ) : (
                  returnStudents.map((stu) => {
                    const isSelected = selectedReturnStudent?.id === stu.id;
                    const lastPrev = stu.previousEnrollments[0];
                    return (
                      <div
                        key={stu.id}
                        onClick={() => {
                          setSelectedReturnStudent(stu);
                          const activeList = returnDestPlacement.length > 0 ? returnDestPlacement : placement;
                          if (activeList.length > 0) {
                            const defYear = activeList.find((y) => y.id === returnYearId) ?? activeList.find((y) => y.isCurrent) ?? activeList[0];
                            if (defYear) {
                              setReturnYearId(defYear.id);
                              const defCls = defYear.classes.find((c) => c.id === returnClassId) ?? defYear.classes[0];
                              if (defCls) {
                                setReturnClassId(defCls.id);
                                const defSec = defCls.sections.find((s) => s.id === returnSectionId) ?? defCls.sections[0];
                                setReturnSectionId(defSec?.id ?? "");
                              }
                            }
                          }
                        }}
                        className={`rounded-2xl border p-3.5 cursor-pointer transition ${isSelected
                            ? "border-blue-500 bg-blue-50/70 ring-1 ring-blue-500"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-xs text-slate-900">{stu.fullName}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                              <span className="font-mono font-semibold text-blue-700">{stu.permanentId}</span>
                              <span>·</span>
                              <span>{stu.gender === "MALE" ? "Male" : "Female"}</span>
                              {stu.phone ? <span>· {stu.phone}</span> : null}
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${stu.isPrimaryAlumni || stu.status === "ALUMNI"
                                ? "bg-slate-100 text-slate-700 ring-1 ring-slate-300"
                                : stu.eligibleForReturn
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                          >
                            {stu.isPrimaryAlumni || stu.status === "ALUMNI"
                              ? "Alumni · Not Eligible for Return"
                              : stu.eligibleForReturn
                                ? `${stu.status} · Eligible`
                                : "Currently Active"}
                          </span>
                        </div>

                        {stu.currentEnrollment ? (
                          <div className="mt-2 rounded-xl bg-emerald-50/80 px-2.5 py-1.5 text-[11px] text-emerald-900 border border-emerald-100">
                            <strong>Current School:</strong> {stu.currentEnrollment.schoolName} · {stu.currentEnrollment.academicYearName} · {stu.currentEnrollment.levelLabel} (Sec {stu.currentEnrollment.sectionName})
                          </div>
                        ) : null}

                        {lastPrev ? (
                          <div className="mt-2 rounded-xl bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600 border border-slate-100">
                            <strong>Last Historical Enrollment:</strong> {lastPrev.schoolName} · {lastPrev.academicYearName} · {lastPrev.levelLabel} (Sec {lastPrev.sectionName}) · <span className="font-semibold">{lastPrev.status}</span>
                            {lastPrev.externalTransfer?.certificateNumber ? (
                              <span className="ml-1 font-mono text-amber-700">
                                [TC #{lastPrev.externalTransfer.certificateNumber}]
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: RE-ENROLLMENT FORM & HISTORICAL RECORDS PREVIEW (6 COLS) */}
          <div className="space-y-4 lg:col-span-6">
            {!selectedReturnStudent ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
                <UserCheck className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-600">Select a Student to Initiate Return / Re-enrollment</p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Reuse the student's existing Master Identity ({`STU-...`}) to re-enroll them in the same school or any eligible school within your organization while keeping all historical enrollments and grades intact.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* STUDENT IDENTITY & HISTORICAL ENROLLMENTS CARD */}
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                        Verified Student Master Identity
                      </span>
                      <h3 className="text-lg font-black text-slate-900">{selectedReturnStudent.fullName}</h3>
                      <p className="font-mono text-xs font-semibold text-slate-500">
                        Master ID: {selectedReturnStudent.permanentId}
                        {selectedReturnStudent.secondaryPermanentId ? ` · Secondary ID: ${selectedReturnStudent.secondaryPermanentId}` : ""}
                      </p>
                    </div>
                    <Link
                      to={`/school/students/${selectedReturnStudent.id}`}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      View Full Profile
                    </Link>
                  </div>

                  {/* PREVIOUS SCHOOL HISTORY (SEPARATE FROM CURRENT) */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Previous School & Enrollment History ({selectedReturnStudent.previousEnrollments.length})
                    </span>
                    {selectedReturnStudent.previousEnrollments.map((hist) => (
                      <div key={hist.id} className="rounded-xl bg-slate-50 p-2.5 text-xs border border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-800">{hist.schoolName}</span>
                          <span className="text-slate-500"> · {hist.academicYearName} · {hist.levelLabel} (Sec {hist.sectionName})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {hist.externalTransfer?.certificateNumber ? (
                            <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800">
                              TC #{hist.externalTransfer.certificateNumber}
                            </span>
                          ) : null}
                          <span className="rounded bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {hist.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* NEW RE-ENROLLMENT PLACEMENT FORM */}
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                    Step 2: Destination Placement & Reason for Return
                  </div>

                  {selectedReturnStudent.isPrimaryAlumni ? (
                    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 leading-relaxed space-y-2">
                      <div className="flex items-center gap-2 font-bold text-amber-950">
                        <GraduationCap className="h-4 w-4 text-amber-700" />
                        Class 8 Alumni Graduate Notice
                      </div>
                      <p>
                        This student completed Class 8 and graduated as <strong>Primary Alumni</strong>. Graduated Alumni cannot be reactivated through the ordinary student return workflow.
                      </p>
                      <p className="text-slate-700">
                        If this school or another school in the organization offers secondary education (Form 1–4), this student can be admitted to Form 1 through the <strong>Form 1 Secondary Admission</strong> progression workflow under Promotions & Alumni.
                      </p>
                    </div>
                  ) : !selectedReturnStudent.eligibleForReturn ? (
                    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900">
                      This student already has an <strong>ACTIVE</strong> enrollment at{" "}
                      <strong>{selectedReturnStudent.currentEnrollment?.schoolName}</strong>. To move an active student to another school in the organization, use <strong>2. Internal Transfer</strong>.
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block sm:col-span-2">
                          <span className="text-xs font-bold text-slate-700">Destination School (Within Organization) *</span>
                          <select
                            value={returnDestSchoolId}
                            onChange={(e) => setReturnDestSchoolId(e.target.value)}
                            className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="SELF">This School (Current Admin School)</option>
                            {schools.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.code})
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold text-slate-700">Academic Year *</span>
                          <select
                            value={returnYearId}
                            onChange={(e) => {
                              const yr = returnDestPlacement.find((y) => y.id === e.target.value);
                              setReturnYearId(e.target.value);
                              setReturnClassId(yr?.classes[0]?.id ?? "");
                              setReturnSectionId(yr?.classes[0]?.sections[0]?.id ?? "");
                            }}
                            className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {returnDestPlacement.length === 0 ? (
                              <option value="">No academic years available</option>
                            ) : null}
                            {returnDestPlacement.map((y) => (
                              <option key={y.id} value={y.id}>
                                {y.name} {y.isCurrent ? "(Current)" : ""}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold text-slate-700">Class / Form *</span>
                          <select
                            value={returnClassId}
                            onChange={(e) => {
                              const yr = returnDestPlacement.find((y) => y.id === returnYearId);
                              const cls = yr?.classes.find((c) => c.id === e.target.value);
                              setReturnClassId(e.target.value);
                              setReturnSectionId(cls?.sections[0]?.id ?? "");
                            }}
                            className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {(returnDestPlacement.find((y) => y.id === returnYearId)?.classes ?? []).length === 0 ? (
                              <option value="">No classes available</option>
                            ) : null}
                            {(returnDestPlacement.find((y) => y.id === returnYearId)?.classes ?? []).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block sm:col-span-2">
                          <span className="text-xs font-bold text-slate-700">Section *</span>
                          <select
                            value={returnSectionId}
                            onChange={(e) => setReturnSectionId(e.target.value)}
                            className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {(
                              returnDestPlacement
                                .find((y) => y.id === returnYearId)
                                ?.classes.find((c) => c.id === returnClassId)?.sections ?? []
                            ).length === 0 ? (
                              <option value="">No sections available</option>
                            ) : null}
                            {(
                              returnDestPlacement
                                .find((y) => y.id === returnYearId)
                                ?.classes.find((c) => c.id === returnClassId)?.sections ?? []
                            ).map((sec) => (
                              <option key={sec.id} value={sec.id}>
                                Section {sec.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block sm:col-span-2">
                          <span className="text-xs font-bold text-slate-700">Reason for Return / Re-enrollment *</span>
                          <textarea
                            rows={3}
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                            placeholder="e.g. Family returned to district, student re-admitted for current term..."
                            className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                      </div>

                      {/* OPTIONAL EXTERNAL EXAMINATION MARKS SECTION */}
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">
                              Optional: External Examination Marks
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Record verified marks obtained at other schools while the student was away.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setReturnExternalMarks((prev) => [
                                ...prev,
                                {
                                  subject: "",
                                  marksObtained: "",
                                  maxMarks: 100,
                                  originSchool: selectedReturnStudent.previousEnrollments[0]?.schoolName ?? "",
                                  examYear: new Date().getFullYear().toString(),
                                  gradeOrClass: "",
                                  isVerified: false,
                                  notes: "",
                                },
                              ]);
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-2xs hover:bg-slate-50"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add External Mark
                          </button>
                        </div>

                        {returnExternalMarks.length > 0 && (
                          <div className="space-y-3 pt-2">
                            {returnExternalMarks.map((mark, idx) => (
                              <div
                                key={idx}
                                className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 text-xs shadow-2xs"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-700 text-[11px] uppercase">
                                    External Mark #{idx + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReturnExternalMarks((prev) => prev.filter((_, i) => i !== idx))
                                    }
                                    className="text-rose-600 hover:text-rose-800 text-[11px] font-bold"
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <label className="block">
                                    <span className="text-[10px] font-bold text-slate-600">Subject *</span>
                                    <input
                                      type="text"
                                      placeholder="e.g. Mathematics"
                                      value={mark.subject}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setReturnExternalMarks((prev) =>
                                          prev.map((m, i) => (i === idx ? { ...m, subject: val } : m)),
                                        );
                                      }}
                                      className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium"
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="text-[10px] font-bold text-slate-600">Marks Obtained *</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="1000"
                                      placeholder="e.g. 78"
                                      value={mark.marksObtained}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setReturnExternalMarks((prev) =>
                                          prev.map((m, i) => (i === idx ? { ...m, marksObtained: val } : m)),
                                        );
                                      }}
                                      className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium"
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="text-[10px] font-bold text-slate-600">Max Marks</span>
                                    <input
                                      type="number"
                                      min="1"
                                      max="1000"
                                      placeholder="100"
                                      value={mark.maxMarks}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setReturnExternalMarks((prev) =>
                                          prev.map((m, i) => (i === idx ? { ...m, maxMarks: val } : m)),
                                        );
                                      }}
                                      className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium"
                                    />
                                  </label>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <label className="block">
                                    <span className="text-[10px] font-bold text-slate-600">Origin School</span>
                                    <input
                                      type="text"
                                      placeholder="e.g. Previous Institution"
                                      value={mark.originSchool}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setReturnExternalMarks((prev) =>
                                          prev.map((m, i) => (i === idx ? { ...m, originSchool: val } : m)),
                                        );
                                      }}
                                      className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium"
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="text-[10px] font-bold text-slate-600">Exam Year / Period</span>
                                    <input
                                      type="text"
                                      placeholder="e.g. 2025/2026"
                                      value={mark.examYear}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setReturnExternalMarks((prev) =>
                                          prev.map((m, i) => (i === idx ? { ...m, examYear: val } : m)),
                                        );
                                      }}
                                      className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium"
                                    />
                                  </label>
                                </div>
                                <label className="inline-flex items-center gap-2 pt-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={mark.isVerified}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setReturnExternalMarks((prev) =>
                                        prev.map((m, i) => (i === idx ? { ...m, isVerified: checked } : m)),
                                      );
                                    }}
                                    className="h-3.5 w-3.5 rounded accent-blue-600"
                                  />
                                  <span className="text-[11px] font-bold text-slate-700">
                                    Verified mark with official documentary evidence
                                  </span>
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl bg-blue-50/70 p-3.5 text-xs text-blue-900 border border-blue-100 leading-relaxed">
                        <strong>Historical Integrity:</strong> Creating this re-enrollment creates a <strong>new active enrollment</strong> without overwriting or deleting any previous enrollments, confirmed transfer records, grades, or attendance.
                      </div>

                      <button
                        type="button"
                        disabled={returnBusy || !returnYearId || !returnSectionId || returnReason.trim().length < 3}
                        onClick={() => void handleSubmitReenrollment()}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-xs font-extrabold text-white shadow-md hover:bg-blue-500 disabled:opacity-40"
                      >
                        {returnBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                        {returnDestSchoolId === "SELF"
                          ? "Approve & Create New Re-enrollment"
                          : "Initiate Return Request to Partner School"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: DIRECTORY DETAILS VIEW */}
      {dirDetailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Transfer Record Details</span>
                  <h3 className="text-xl font-black text-slate-900">
                    {dirDetailItem.student.firstName} {dirDetailItem.student.fatherName} {dirDetailItem.student.grandfatherName}
                  </h3>
                  <p className="font-mono text-xs text-slate-500">{dirDetailItem.student.permanentId}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDirDetailItem(null)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Certificate #</span>
                  <p className="font-mono font-bold text-blue-600 mt-0.5">{dirDetailItem.certificateNumber}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Transfer Status</span>
                  <p className="font-bold text-slate-900 mt-0.5">{dirDetailItem.status}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Destination School</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{dirDetailItem.destinationSchoolName || "Not specified"}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Last Enrolled Class</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {dirDetailItem.enrollment.classGroup.level.replace("CLASS_", "Class ").replace("FORM_", "Form ")}
                    {dirDetailItem.enrollment.section && ` Sec ${dirDetailItem.enrollment.section.name}`}
                  </p>
                </div>
              </div>

              {dirDetailItem.reason && (
                <div className="rounded-2xl bg-slate-50 p-3 text-xs border border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Transfer Reason</span>
                  <p className="text-slate-800 mt-0.5">{dirDetailItem.reason}</p>
                </div>
              )}

              {dirDetailItem.confirmedByUser && (
                <div className="text-xs text-slate-500 pt-1">
                  Confirmed by: <span className="font-bold text-slate-700">{dirDetailItem.confirmedByUser.firstName} {dirDetailItem.confirmedByUser.lastName}</span>
                  {dirDetailItem.confirmedAt && ` on ${transferDate(dirDetailItem.confirmedAt)}`}
                </div>
              )}

              {dirDetailItem.status === "REVERSED" && (
                <div className="rounded-2xl bg-indigo-50 p-3 text-xs border border-indigo-200 text-indigo-900 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-indigo-700">Erroneous Transfer Reversed</span>
                  <p>{dirDetailItem.reversalReason || "Reversed by administrator"}</p>
                  {dirDetailItem.reversedByUser && (
                    <p className="text-[11px] text-indigo-700">
                      Reversed by {dirDetailItem.reversedByUser.firstName} {dirDetailItem.reversedByUser.lastName}
                      {dirDetailItem.reversedAt ? ` on ${transferDate(dirDetailItem.reversedAt)}` : ""}
                    </p>
                  )}
                </div>
              )}

              {/* SEPARATE ERRONEOUS TRANSFER REVERSAL WORKFLOW */}
              {dirDetailItem.status === "CONFIRMED" && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-rose-900 uppercase tracking-wider text-[10px]">
                      Correction Only: Reverse Erroneous Transfer
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const item = dirDetailItem;
                        setDirDetailItem(null);
                        handleReturnFromDirectory(item);
                      }}
                      className="text-[11px] font-bold text-blue-700 hover:underline"
                    >
                      Genuine Return? Use Re-enroll →
                    </button>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    Use this <strong>only if the original transfer was recorded by mistake</strong>. If the student genuinely left the school and is now returning, use <strong>5. Return & Re-enroll Student</strong> instead so a new enrollment is created.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={reversalReasonInput}
                      onChange={(e) => setReversalReasonInput(e.target.value)}
                      placeholder="Reason for reversing erroneous transfer..."
                      className="flex-1 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                    <button
                      type="button"
                      disabled={reversalBusy || reversalReasonInput.trim().length < 3}
                      onClick={() => void handleReverseErroneousTransfer()}
                      className="rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-40"
                    >
                      {reversalBusy ? "Reversing..." : "Reverse Transfer"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <button
                type="button"
                onClick={() => setDirDetailItem(null)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: FINAL EXTERNAL TRANSFER CONFIRMATION */}
      {extShowConfirmModal && extSelectedStudent && extDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-amber-600">
                <AlertCircle className="h-6 w-6 shrink-0" />
                <h3 className="text-xl font-black text-slate-900">Final Confirmation Required</h3>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                You are about to finalize the external transfer for{" "}
                <strong className="text-slate-900">{extSelectedStudent.name}</strong> (ID: {extSelectedStudent.permanentId}).
              </p>

              <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200 text-xs text-amber-900 space-y-2">
                <p className="font-bold">By proceeding:</p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800">
                  <li>The student's enrollment status will become <strong>TRANSFERRED</strong>.</li>
                  <li>The student's global status will become <strong>WITHDRAWN</strong>.</li>
                  <li>The certificate number <strong>{extDraft.certificateNumber}</strong> will be permanently linked.</li>
                  <li>All past examination records, grades, and attendance remain fully preserved.</li>
                </ul>
              </div>

              <div className="text-xs text-slate-500">
                Destination School: <strong>{extDestinationSchool || "Outside organization"}</strong>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <button
                type="button"
                disabled={extActionBusy}
                onClick={() => setExtShowConfirmModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={extActionBusy}
                onClick={() => void handleConfirmExternalTransfer()}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-amber-500 disabled:opacity-50"
              >
                {extActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Yes, Finalize Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: SECTION MOVE */}
      {sectionReviewIds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6">
              <h3 className="text-xl font-black text-slate-900">Confirm Section Move</h3>
              <p className="mt-1 text-xs text-slate-500">
                Moving {sectionReviewIds.length} student{sectionReviewIds.length === 1 ? "" : "s"} within your school.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Source
                  </span>
                  <p className="mt-1 text-xs font-bold text-slate-800">{fromLabel}</p>
                </div>

                <div className="rounded-2xl bg-blue-50 p-3.5 border border-blue-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                    Destination
                  </span>
                  <p className="mt-1 text-xs font-bold text-blue-900">
                    {sourceClass?.label} · Section {destinationSection?.name}
                  </p>
                </div>
              </div>

              <div className="mt-4 max-h-48 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/50 p-3 text-xs divide-y divide-slate-100">
                {students
                  .filter((s) => sectionReviewIds.includes(s.enrollmentId))
                  .map((s) => (
                    <div key={s.enrollmentId} className="py-1.5 flex justify-between">
                      <span className="font-bold text-slate-800">{s.name}</span>
                      <span className="font-mono text-slate-500">{s.permanentId}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <button
                type="button"
                onClick={() => setSectionReviewIds(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={moveBusy}
                onClick={() => {
                  setMoveBusy(true);
                  setError("");
                  api<{ count: number }>("/api/v1/section-moves/batch", {
                    method: "POST",
                    body: JSON.stringify({
                      enrollmentIds: sectionReviewIds,
                      toSectionId: destSectionId,
                    }),
                  })
                    .then((result) => {
                      setMessage(
                        `Successfully moved ${result.count} students to Section ${destinationSection?.name}.`,
                      );
                      setSectionReviewIds(null);
                      setSelectedEnrollmentIds([]);
                      setDestSectionId("");
                      return api<{ students: StudentRow[] }>(
                        `/api/v1/students?academicYearId=${sourceYearId}&sectionId=${sourceSectionId}&status=ACTIVE`,
                      ).then((res) => setStudents(res.students));
                    })
                    .catch((caught: unknown) =>
                      setError(
                        caught instanceof Error
                          ? caught.message
                          : "Could not complete the section move.",
                      ),
                    )
                    .finally(() => setMoveBusy(false));
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-blue-500 disabled:opacity-50"
              >
                {moveBusy ? "Moving..." : "Confirm & Move"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: EXTERNAL TRANSFER */}
      {schoolReviewIds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6">
              <h3 className="text-xl font-black text-slate-900">Confirm School Transfer</h3>
              <p className="mt-1 text-xs text-slate-500">
                Transferring {schoolReviewIds.length} student{schoolReviewIds.length === 1 ? "" : "s"} to another partner school.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Source
                  </span>
                  <p className="mt-1 text-xs font-bold text-slate-800">{fromLabel}</p>
                </div>

                <div className="rounded-2xl bg-indigo-50 p-3.5 border border-indigo-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                    Destination School
                  </span>
                  <p className="mt-1 text-xs font-bold text-indigo-900">
                    {compatibleSchools.find((s) => s.id === toSchoolId)?.name}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-700">
                <strong>Reason:</strong> {transferReason}
              </div>

              <div className="mt-4 max-h-48 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/50 p-3 text-xs divide-y divide-slate-100">
                {students
                  .filter((s) => schoolReviewIds.includes(s.enrollmentId))
                  .map((s) => (
                    <div key={s.enrollmentId} className="py-1.5 flex justify-between">
                      <span className="font-bold text-slate-800">{s.name}</span>
                      <span className="font-mono text-slate-500">{s.permanentId}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <button
                type="button"
                onClick={() => setSchoolReviewIds(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={moveBusy}
                onClick={() => {
                  setMoveBusy(true);
                  void requestTransfer(schoolReviewIds).finally(() => {
                    setSchoolReviewIds(null);
                    setMoveBusy(false);
                  });
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-indigo-500 disabled:opacity-50"
              >
                {moveBusy ? "Sending..." : "Confirm & Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TransferStatus({ status }: { status: string }) {
  const tones: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
    PENDING: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon: Clock },
    WAITING_FOR_SECTION: { bg: "bg-orange-50 border-orange-200", text: "text-orange-700", icon: Clock3 },
    COMPLETED: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", icon: CheckCircle2 },
    REJECTED: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", icon: XCircle },
  };

  const item = tones[status] ?? {
    bg: "bg-slate-50 border-slate-200",
    text: "text-slate-600",
    icon: CheckCircle2,
  };
  const Icon = item.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${item.bg} ${item.text}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {status.replaceAll("_", " ")}
    </span>
  );
}
