import { PrismaClient, Gender, LevelCode, TermCode, MarkState } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Academic Year & Bilal Student Seeding...");

  const schoolId = "cmv3n5c7h000bts2kagquqsk6"; // Xaafuun Secondary School
  const guardianId = "cmv41y57j0018tsekkjpf24vi"; // Bilal Nuur

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: { organization: true },
  });
  if (!school) throw new Error("School not found!");

  const guardian = await prisma.guardian.findUnique({
    where: { id: guardianId },
  });
  if (!guardian) throw new Error("Bilal guardian not found!");

  const admin = await prisma.user.findFirst({
    where: { schoolId, role: "SCHOOL_ADMIN" },
  }) || await prisma.user.findFirst();
  const adminId = admin ? admin.id : "system-admin";

  console.log(`School: ${school.name} (${school.code})`);
  console.log(`Guardian: ${guardian.firstName} ${guardian.lastName}`);
  console.log(`Admin User: ${adminId}`);

  // 1. Create New Academic Year: "Academic Year 2033-2034"
  // Make other years isCurrent: false
  await prisma.academicYear.updateMany({
    where: { schoolId },
    data: { isCurrent: false },
  });

  const yearName = "Academic Year 2033-2034";
  let academicYear = await prisma.academicYear.findFirst({
    where: { schoolId, name: yearName },
  });

  if (!academicYear) {
    academicYear = await prisma.academicYear.create({
      data: {
        schoolId,
        name: yearName,
        startDate: new Date("2033-09-01T00:00:00Z"),
        endDate: new Date("2034-06-30T00:00:00Z"),
        isCurrent: true,
        isDemo: true,
      },
    });
    console.log(`Created new Academic Year: ${academicYear.name} (${academicYear.id})`);
  } else {
    academicYear = await prisma.academicYear.update({
      where: { id: academicYear.id },
      data: { isCurrent: true },
    });
    console.log(`Using existing Academic Year: ${academicYear.name}`);
  }

  // 2. Create Classes & Sections: Form 1 to Form 4, Section A
  const levels: LevelCode[] = ["FORM_1", "FORM_2", "FORM_3", "FORM_4"];
  const classGroupMap = new Map<LevelCode, { classGroupId: string; sectionId: string }>();

  for (const level of levels) {
    let classGroup = await prisma.classGroup.findFirst({
      where: { academicYearId: academicYear.id, level },
    });
    if (!classGroup) {
      classGroup = await prisma.classGroup.create({
        data: {
          schoolId,
          academicYearId: academicYear.id,
          level,
        },
      });
    }

    let section = await prisma.section.findFirst({
      where: { classGroupId: classGroup.id, name: "A" },
    });
    if (!section) {
      section = await prisma.section.create({
        data: {
          classGroupId: classGroup.id,
          name: "A",
        },
      });
    }

    classGroupMap.set(level, { classGroupId: classGroup.id, sectionId: section.id });
    console.log(`Ready: ${level} -> Section A`);
  }

  // 3. Ensure standard subjects exist in the school
  const subjectDefs = [
    { name: "Mathematics", code: "MATH" },
    { name: "English", code: "ENGLISH" },
    { name: "Physics", code: "PHYSICS" },
    { name: "Chemistry", code: "CHEMISTRY" },
    { name: "Islamic Studies", code: "ISLAMIC" },
    { name: "Biology", code: "BIOLOGY" },
    { name: "SOMALI", code: "SOMALI" },
  ];

  const subjects = new Map<string, string>();
  for (const sDef of subjectDefs) {
    let sub = await prisma.subject.findFirst({
      where: { schoolId, code: sDef.code },
    });
    if (!sub) {
      sub = await prisma.subject.create({
        data: {
          schoolId,
          name: sDef.name,
          code: sDef.code,
        },
      });
    }
    subjects.set(sDef.code, sub.id);
  }

  // 4. Create 3 New Students linked to Bilal Nuur
  const studentsToCreate = [
    {
      permanentId: "STU-BILAL-F1-01",
      firstName: "Mustafe",
      fatherName: "Bilal",
      grandfatherName: "Nuur",
      gender: Gender.MALE,
      dateOfBirth: new Date("2011-04-12"),
      level: "FORM_1" as LevelCode,
      roll: 1,
      studentNumber: "SN-BILAL-01",
      profile: "High Performer (Grade A+)",
    },
    {
      permanentId: "STU-BILAL-F2-02",
      firstName: "Fadumo",
      fatherName: "Bilal",
      grandfatherName: "Nuur",
      gender: Gender.FEMALE,
      dateOfBirth: new Date("2010-08-22"),
      level: "FORM_2" as LevelCode,
      roll: 1,
      studentNumber: "SN-BILAL-02",
      profile: "Deductions & Absent Subject",
    },
    {
      permanentId: "STU-BILAL-F3-03",
      firstName: "Saciid",
      fatherName: "Bilal",
      grandfatherName: "Nuur",
      gender: Gender.MALE,
      dateOfBirth: new Date("2009-11-05"),
      level: "FORM_3" as LevelCode,
      roll: 1,
      studentNumber: "SN-BILAL-03",
      profile: "Re-Exam Performed",
    },
  ];

  const enrollments: Record<string, string> = {};

  for (const sData of studentsToCreate) {
    let student = await prisma.student.findUnique({
      where: { permanentId: sData.permanentId },
    });

    if (!student) {
      student = await prisma.student.create({
        data: {
          organizationId: school.organizationId,
          permanentId: sData.permanentId,
          firstName: sData.firstName,
          fatherName: sData.fatherName,
          grandfatherName: sData.grandfatherName,
          gender: sData.gender,
          dateOfBirth: sData.dateOfBirth,
          isDemo: true,
        },
      });
      console.log(`Created student: ${sData.firstName} ${sData.fatherName} (${sData.permanentId})`);
    }

    // Link student to guardian Bilal
    const link = await prisma.studentGuardian.findUnique({
      where: { studentId_guardianId: { studentId: student.id, guardianId } },
    });
    if (!link) {
      await prisma.studentGuardian.create({
        data: {
          studentId: student.id,
          guardianId,
          relationship: "FATHER",
        },
      });
      console.log(`Linked ${student.firstName} to Bilal as FATHER`);
    }

    // Enroll in current Academic Year
    const classData = classGroupMap.get(sData.level)!;
    let enrollment = await prisma.enrollment.findUnique({
      where: { studentId_academicYearId: { studentId: student.id, academicYearId: academicYear.id } },
    });

    if (!enrollment) {
      enrollment = await prisma.enrollment.create({
        data: {
          studentId: student.id,
          schoolId,
          academicYearId: academicYear.id,
          classGroupId: classData.classGroupId,
          sectionId: classData.sectionId,
          studentNumber: sData.studentNumber,
          rollNumber: sData.roll,
          status: "ACTIVE",
        },
      });
      console.log(`Enrolled ${student.firstName} in ${sData.level} Section A`);
    }
    enrollments[sData.permanentId] = enrollment.id;
  }

  // Also add 1 classmate in each class for realistic class comparison
  const classmates = [
    { permanentId: "STU-CLASS-F1-02", firstName: "Hassan", fatherName: "Ali", grandfatherName: "Jama", gender: Gender.MALE, level: "FORM_1" as LevelCode, roll: 2, num: "SN-CLS-F1-02" },
    { permanentId: "STU-CLASS-F2-02", firstName: "Maryan", fatherName: "Abdi", grandfatherName: "Omar", gender: Gender.FEMALE, level: "FORM_2" as LevelCode, roll: 2, num: "SN-CLS-F2-02" },
    { permanentId: "STU-CLASS-F3-02", firstName: "Yusuf", fatherName: "Khadar", grandfatherName: "Warsame", gender: Gender.MALE, level: "FORM_3" as LevelCode, roll: 2, num: "SN-CLS-F3-02" },
    { permanentId: "STU-CLASS-F4-01", firstName: "Sahra", fatherName: "Mahamud", grandfatherName: "Elmi", gender: Gender.FEMALE, level: "FORM_4" as LevelCode, roll: 1, num: "SN-CLS-F4-01" },
  ];

  for (const cData of classmates) {
    let student = await prisma.student.findUnique({ where: { permanentId: cData.permanentId } });
    if (!student) {
      student = await prisma.student.create({
        data: {
          organizationId: school.organizationId,
          permanentId: cData.permanentId,
          firstName: cData.firstName,
          fatherName: cData.fatherName,
          grandfatherName: cData.grandfatherName,
          gender: cData.gender,
          dateOfBirth: new Date("2010-01-01"),
          isDemo: true,
        },
      });
    }
    const classData = classGroupMap.get(cData.level)!;
    let enrollment = await prisma.enrollment.findUnique({
      where: { studentId_academicYearId: { studentId: student.id, academicYearId: academicYear.id } },
    });
    if (!enrollment) {
      enrollment = await prisma.enrollment.create({
        data: {
          studentId: student.id,
          schoolId,
          academicYearId: academicYear.id,
          classGroupId: classData.classGroupId,
          sectionId: classData.sectionId,
          studentNumber: cData.num,
          rollNumber: cData.roll,
          status: "ACTIVE",
        },
      });
    }
    enrollments[cData.permanentId] = enrollment.id;
  }

  // 5. Create Exam Term 1:
  // Subjects: Math, English, Physics, Chemistry, Islamic Studies (5 subjects)
  const term1SubjectCodes = ["MATH", "ENGLISH", "PHYSICS", "CHEMISTRY", "ISLAMIC"];

  let examTerm1 = await prisma.exam.findUnique({
    where: { academicYearId_term: { academicYearId: academicYear.id, term: TermCode.TERM_1 } },
  });

  if (!examTerm1) {
    examTerm1 = await prisma.exam.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        term: TermCode.TERM_1,
        examDate: new Date("2033-11-15T00:00:00Z"),
        endDate: new Date("2033-11-25T00:00:00Z"),
        generalMax: 100,
      },
    });
    console.log(`Created Exam: Term 1 (${examTerm1.id})`);
  }

  // Link classes & sections to Term 1
  for (const level of levels) {
    const classData = classGroupMap.get(level)!;
    await prisma.examClass.upsert({
      where: { examId_classGroupId: { examId: examTerm1.id, classGroupId: classData.classGroupId } },
      create: { examId: examTerm1.id, classGroupId: classData.classGroupId },
      update: {},
    });
    await prisma.examSection.upsert({
      where: { examId_sectionId: { examId: examTerm1.id, sectionId: classData.sectionId } },
      create: { examId: examTerm1.id, sectionId: classData.sectionId },
      update: {},
    });

    for (const code of term1SubjectCodes) {
      const subjectId = subjects.get(code)!;
      await prisma.examSubject.upsert({
        where: { examId_classGroupId_subjectId: { examId: examTerm1.id, classGroupId: classData.classGroupId, subjectId } },
        create: {
          examId: examTerm1.id,
          classGroupId: classData.classGroupId,
          subjectId,
          maxMarks: 100,
          minMarks: 50,
        },
        update: {},
      });
    }
  }

  // 6. Enter & Publish Marks for Term 1
  console.log("Entering & Publishing Term 1 Marks...");
  const term1ExamSubjects = await prisma.examSubject.findMany({
    where: { examId: examTerm1.id },
  });

  // Helper to find examSubjectId
  function getSubj(classGroupId: string, code: string) {
    const sId = subjects.get(code)!;
    return term1ExamSubjects.find(s => s.classGroupId === classGroupId && s.subjectId === sId)!.id;
  }

  // Student 1: Mustafe Bilal Nuur (Form 1) -> High Marks
  const f1 = classGroupMap.get("FORM_1")!;
  const mustafeEnrollmentId = enrollments["STU-BILAL-F1-01"];
  const mustafeTerm1Marks = [
    { code: "MATH", marks: 95, absent: false },
    { code: "ENGLISH", marks: 92, absent: false },
    { code: "PHYSICS", marks: 89, absent: false },
    { code: "CHEMISTRY", marks: 94, absent: false },
    { code: "ISLAMIC", marks: 98, absent: false },
  ];
  for (const m of mustafeTerm1Marks) {
    await prisma.subjectResult.upsert({
      where: { enrollmentId_examSubjectId: { enrollmentId: mustafeEnrollmentId, examSubjectId: getSubj(f1.classGroupId, m.code) } },
      create: {
        enrollmentId: mustafeEnrollmentId,
        examSubjectId: getSubj(f1.classGroupId, m.code),
        marks: m.marks,
        isAbsent: m.absent,
        state: MarkState.PUBLISHED,
        submittedAt: new Date(),
        reviewedAt: new Date(),
        publishedAt: new Date(),
        publishedByUserId: adminId,
      },
      update: {
        marks: m.marks,
        isAbsent: m.absent,
        state: MarkState.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  // Student 2: Fadumo Bilal Nuur (Form 2) -> Deductions + ABSENT on Chemistry
  const f2 = classGroupMap.get("FORM_2")!;
  const fadumoEnrollmentId = enrollments["STU-BILAL-F2-02"];
  const fadumoTerm1Marks = [
    { code: "MATH", marks: 64, absent: false },
    { code: "ENGLISH", marks: 58, absent: false },
    { code: "PHYSICS", marks: 45, absent: false }, // failing/deducted
    { code: "ISLAMIC", marks: 72, absent: false },
    { code: "CHEMISTRY", marks: null, absent: true }, // ABSENT! Counts as 0 in denominator
  ];
  for (const m of fadumoTerm1Marks) {
    await prisma.subjectResult.upsert({
      where: { enrollmentId_examSubjectId: { enrollmentId: fadumoEnrollmentId, examSubjectId: getSubj(f2.classGroupId, m.code) } },
      create: {
        enrollmentId: fadumoEnrollmentId,
        examSubjectId: getSubj(f2.classGroupId, m.code),
        marks: m.marks,
        isAbsent: m.absent,
        state: MarkState.PUBLISHED,
        submittedAt: new Date(),
        reviewedAt: new Date(),
        publishedAt: new Date(),
        publishedByUserId: adminId,
      },
      update: {
        marks: m.marks,
        isAbsent: m.absent,
        state: MarkState.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  // Student 3: Saciid Bilal Nuur (Form 3) -> RE-EXAM on Physics!
  const f3 = classGroupMap.get("FORM_3")!;
  const saciidEnrollmentId = enrollments["STU-BILAL-F3-03"];
  const saciidTerm1Marks = [
    { code: "MATH", marks: 80, absent: false, comment: null },
    { code: "ENGLISH", marks: 74, absent: false, comment: null },
    { code: "ISLAMIC", marks: 86, absent: false, comment: null },
    { code: "CHEMISTRY", marks: 79, absent: false, comment: null },
    { code: "PHYSICS", marks: 76, absent: false, comment: "RE_EXAM:32" }, // RE-EXAM! (previous mark was 32)
  ];
  for (const m of saciidTerm1Marks) {
    await prisma.subjectResult.upsert({
      where: { enrollmentId_examSubjectId: { enrollmentId: saciidEnrollmentId, examSubjectId: getSubj(f3.classGroupId, m.code) } },
      create: {
        enrollmentId: saciidEnrollmentId,
        examSubjectId: getSubj(f3.classGroupId, m.code),
        marks: m.marks,
        isAbsent: m.absent,
        comment: m.comment,
        state: MarkState.PUBLISHED,
        submittedAt: new Date(),
        reviewedAt: new Date(),
        publishedAt: new Date(),
        publishedByUserId: adminId,
      },
      update: {
        marks: m.marks,
        isAbsent: m.absent,
        comment: m.comment,
        state: MarkState.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  // Classmates in Term 1
  const classmatesTerm1 = [
    { enrollId: enrollments["STU-CLASS-F1-02"], fGroup: f1, scores: [82, 80, 75, 78, 85] },
    { enrollId: enrollments["STU-CLASS-F2-02"], fGroup: f2, scores: [70, 68, 65, 75, 72] },
    { enrollId: enrollments["STU-CLASS-F3-02"], fGroup: f3, scores: [88, 85, 90, 84, 89] },
    { enrollId: enrollments["STU-CLASS-F4-01"], fGroup: classGroupMap.get("FORM_4")!, scores: [84, 82, 80, 78, 86] },
  ];
  for (const cm of classmatesTerm1) {
    term1SubjectCodes.forEach(async (code, idx) => {
      await prisma.subjectResult.upsert({
        where: { enrollmentId_examSubjectId: { enrollmentId: cm.enrollId, examSubjectId: getSubj(cm.fGroup.classGroupId, code) } },
        create: {
          enrollmentId: cm.enrollId,
          examSubjectId: getSubj(cm.fGroup.classGroupId, code),
          marks: cm.scores[idx],
          isAbsent: false,
          state: MarkState.PUBLISHED,
          submittedAt: new Date(),
          reviewedAt: new Date(),
          publishedAt: new Date(),
          publishedByUserId: adminId,
        },
        update: {
          marks: cm.scores[idx],
          isAbsent: false,
          state: MarkState.PUBLISHED,
          publishedAt: new Date(),
        },
      });
    });
  }

  // Create ResultPublication for Term 1
  await prisma.resultPublication.create({
    data: {
      examId: examTerm1.id,
      schoolId,
      publishedByUserId: adminId,
      publishedCount: 35,
      classCount: 4,
      subjectCount: 5,
    },
  });
  console.log("Term 1 Results Published successfully!");

  // 7. Create Exam Term 2:
  // User Requirement: "TERMS QAAR KU DAR SUBJECT , QAAR KA SAR"
  // Term 2 Subjects:
  // ADDED: BIOLOGY, SOMALI
  // REMOVED: CHEMISTRY (left out from Term 2)
  // Remaining: MATH, ENGLISH, PHYSICS, ISLAMIC, BIOLOGY, SOMALI (6 subjects)
  const term2SubjectCodes = ["MATH", "ENGLISH", "PHYSICS", "ISLAMIC", "BIOLOGY", "SOMALI"];

  let examTerm2 = await prisma.exam.findUnique({
    where: { academicYearId_term: { academicYearId: academicYear.id, term: TermCode.TERM_2 } },
  });

  if (!examTerm2) {
    examTerm2 = await prisma.exam.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        term: TermCode.TERM_2,
        examDate: new Date("2034-04-10T00:00:00Z"),
        endDate: new Date("2034-04-20T00:00:00Z"),
        generalMax: 100,
      },
    });
    console.log(`Created Exam: Term 2 (${examTerm2.id})`);
  }

  // Link classes & sections to Term 2
  for (const level of levels) {
    const classData = classGroupMap.get(level)!;
    await prisma.examClass.upsert({
      where: { examId_classGroupId: { examId: examTerm2.id, classGroupId: classData.classGroupId } },
      create: { examId: examTerm2.id, classGroupId: classData.classGroupId },
      update: {},
    });
    await prisma.examSection.upsert({
      where: { examId_sectionId: { examId: examTerm2.id, sectionId: classData.sectionId } },
      create: { examId: examTerm2.id, sectionId: classData.sectionId },
      update: {},
    });

    for (const code of term2SubjectCodes) {
      const subjectId = subjects.get(code)!;
      await prisma.examSubject.upsert({
        where: { examId_classGroupId_subjectId: { examId: examTerm2.id, classGroupId: classData.classGroupId, subjectId } },
        create: {
          examId: examTerm2.id,
          classGroupId: classData.classGroupId,
          subjectId,
          maxMarks: 100,
          minMarks: 50,
        },
        update: {},
      });
    }
  }

  // 8. Enter & Publish Marks for Term 2
  console.log("Entering & Publishing Term 2 Marks...");
  const term2ExamSubjects = await prisma.examSubject.findMany({
    where: { examId: examTerm2.id },
  });

  function getSubj2(classGroupId: string, code: string) {
    const sId = subjects.get(code)!;
    return term2ExamSubjects.find(s => s.classGroupId === classGroupId && s.subjectId === sId)!.id;
  }

  // Student 1: Mustafe Bilal Nuur (Form 1) -> Continues High Scores in Term 2
  const mustafeTerm2Marks = [
    { code: "MATH", marks: 96, absent: false },
    { code: "ENGLISH", marks: 94, absent: false },
    { code: "PHYSICS", marks: 91, absent: false },
    { code: "ISLAMIC", marks: 99, absent: false },
    { code: "BIOLOGY", marks: 95, absent: false }, // Newly added subject
    { code: "SOMALI", marks: 92, absent: false },  // Newly added subject
  ];
  for (const m of mustafeTerm2Marks) {
    await prisma.subjectResult.upsert({
      where: { enrollmentId_examSubjectId: { enrollmentId: mustafeEnrollmentId, examSubjectId: getSubj2(f1.classGroupId, m.code) } },
      create: {
        enrollmentId: mustafeEnrollmentId,
        examSubjectId: getSubj2(f1.classGroupId, m.code),
        marks: m.marks,
        isAbsent: m.absent,
        state: MarkState.PUBLISHED,
        submittedAt: new Date(),
        reviewedAt: new Date(),
        publishedAt: new Date(),
        publishedByUserId: adminId,
      },
      update: {
        marks: m.marks,
        isAbsent: m.absent,
        state: MarkState.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  // Student 2: Fadumo Bilal Nuur (Form 2) -> Mixed Marks + ABSENT in Somali
  const fadumoTerm2Marks = [
    { code: "MATH", marks: 68, absent: false },
    { code: "ENGLISH", marks: 62, absent: false },
    { code: "PHYSICS", marks: 54, absent: false },
    { code: "ISLAMIC", marks: 76, absent: false },
    { code: "BIOLOGY", marks: 60, absent: false },
    { code: "SOMALI", marks: null, absent: true }, // ABSENT in Somali!
  ];
  for (const m of fadumoTerm2Marks) {
    await prisma.subjectResult.upsert({
      where: { enrollmentId_examSubjectId: { enrollmentId: fadumoEnrollmentId, examSubjectId: getSubj2(f2.classGroupId, m.code) } },
      create: {
        enrollmentId: fadumoEnrollmentId,
        examSubjectId: getSubj2(f2.classGroupId, m.code),
        marks: m.marks,
        isAbsent: m.absent,
        state: MarkState.PUBLISHED,
        submittedAt: new Date(),
        reviewedAt: new Date(),
        publishedAt: new Date(),
        publishedByUserId: adminId,
      },
      update: {
        marks: m.marks,
        isAbsent: m.absent,
        state: MarkState.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  // Student 3: Saciid Bilal Nuur (Form 3) -> Re-Exam on BIOLOGY!
  const saciidTerm2Marks = [
    { code: "MATH", marks: 84, absent: false, comment: null },
    { code: "ENGLISH", marks: 78, absent: false, comment: null },
    { code: "PHYSICS", marks: 82, absent: false, comment: null },
    { code: "ISLAMIC", marks: 91, absent: false, comment: null },
    { code: "SOMALI", marks: 85, absent: false, comment: null },
    { code: "BIOLOGY", marks: 81, absent: false, comment: "RE_EXAM:" }, // Re-Exam was taken after being absent!
  ];
  for (const m of saciidTerm2Marks) {
    await prisma.subjectResult.upsert({
      where: { enrollmentId_examSubjectId: { enrollmentId: saciidEnrollmentId, examSubjectId: getSubj2(f3.classGroupId, m.code) } },
      create: {
        enrollmentId: saciidEnrollmentId,
        examSubjectId: getSubj2(f3.classGroupId, m.code),
        marks: m.marks,
        isAbsent: m.absent,
        comment: m.comment,
        state: MarkState.PUBLISHED,
        submittedAt: new Date(),
        reviewedAt: new Date(),
        publishedAt: new Date(),
        publishedByUserId: adminId,
      },
      update: {
        marks: m.marks,
        isAbsent: m.absent,
        comment: m.comment,
        state: MarkState.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  // Classmates in Term 2
  const classmatesTerm2 = [
    { enrollId: enrollments["STU-CLASS-F1-02"], fGroup: f1, scores: [84, 82, 78, 88, 80, 85] },
    { enrollId: enrollments["STU-CLASS-F2-02"], fGroup: f2, scores: [72, 70, 68, 76, 74, 75] },
    { enrollId: enrollments["STU-CLASS-F3-02"], fGroup: f3, scores: [90, 88, 92, 94, 89, 91] },
    { enrollId: enrollments["STU-CLASS-F4-01"], fGroup: classGroupMap.get("FORM_4")!, scores: [86, 84, 82, 88, 85, 87] },
  ];
  for (const cm of classmatesTerm2) {
    term2SubjectCodes.forEach(async (code, idx) => {
      await prisma.subjectResult.upsert({
        where: { enrollmentId_examSubjectId: { enrollmentId: cm.enrollId, examSubjectId: getSubj2(cm.fGroup.classGroupId, code) } },
        create: {
          enrollmentId: cm.enrollId,
          examSubjectId: getSubj2(cm.fGroup.classGroupId, code),
          marks: cm.scores[idx],
          isAbsent: false,
          state: MarkState.PUBLISHED,
          submittedAt: new Date(),
          reviewedAt: new Date(),
          publishedAt: new Date(),
          publishedByUserId: adminId,
        },
        update: {
          marks: cm.scores[idx],
          isAbsent: false,
          state: MarkState.PUBLISHED,
          publishedAt: new Date(),
        },
      });
    });
  }

  // Create ResultPublication for Term 2
  await prisma.resultPublication.create({
    data: {
      examId: examTerm2.id,
      schoolId,
      publishedByUserId: adminId,
      publishedCount: 42,
      classCount: 4,
      subjectCount: 6,
    },
  });
  console.log("Term 2 Results Published successfully!");

  console.log("\n==============================================");
  console.log("SUCCESSFULLY COMPLETED SEEDING:");
  console.log(`- Academic Year: ${academicYear.name} (Active/Current)`);
  console.log("- Classes: Form 1 A, Form 2 A, Form 3 A, Form 4 A");
  console.log("- Bilal's 3 New Children:");
  console.log("  1. Mustafe Bilal Nuur (Form 1 A) -> High scores (Grade A+)");
  console.log("  2. Fadumo Bilal Nuur (Form 2 A) -> Deductions + Absent (Chemistry in T1, Somali in T2)");
  console.log("  3. Saciid Bilal Nuur (Form 3 A) -> Re-Exams (Physics in T1, Biology in T2)");
  console.log("- Terms & Subject Management:");
  console.log("  * Term 1 (5 subjects): Math, English, Physics, Chemistry, Islamic");
  console.log("  * Term 2 (6 subjects): Added Biology & Somali; Removed Chemistry");
  console.log("- Status: All results PUBLISHED for parent and student viewing.");
  console.log("==============================================\n");
}

main()
  .catch((err) => {
    console.error("Error seeding academic year & Bilal students:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
